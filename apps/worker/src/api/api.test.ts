import { describe, expect, test } from "vitest";
import { ContextResponse, SearchResponse } from "@truman/contracts";
import { handleApi, type ApiContext, type Rpc } from "./index";
import { RateLimiter, parseOrigins, type EdgeCache } from "./http";
import { MyMemoryTranslator, chunkText, translateWithFallback, type Translator } from "./translate";
import { sizeMode, sizeReport } from "../governor/size";

class FakeRpc implements Rpc {
  calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  constructor(public answers: Record<string, unknown> = {}) {}
  async rpc(name: string, args: Record<string, unknown> = {}): Promise<unknown> {
    this.calls.push({ name, args });
    const a = this.answers[name];
    return typeof a === "function" ? (a as (x: Record<string, unknown>) => unknown)(args) : a;
  }
  count(name: string) {
    return this.calls.filter((c) => c.name === name).length;
  }
}

const memCache = (): EdgeCache => {
  const m = new Map<string, Response>();
  return {
    match: async (k) => m.get(k)?.clone(),
    put: async (k, r) => void m.set(k, r),
  };
};

const TOKEN = "t".repeat(32);
function mk(db: FakeRpc, over: Partial<ApiContext> = {}): ApiContext {
  return {
    db,
    env: { allowedOrigins: ["https://truman.pages.dev"] },
    adminToken: TOKEN,
    translators: [],
    translateDayCap: 2,
    runTick: async () => ({ ran: true }),
    cache: memCache(),
    now: () => 1_000_000,
    limiter: new RateLimiter(1000, 60_000),
    searchLimiter: new RateLimiter(1000, 60_000),
    adminFailures: new RateLimiter(5, 900_000),
    ...over,
  };
}
const get = (path: string, init: RequestInit = {}) => new Request(`https://w.test${path}`, init);
const entry = (id: number, extra: Record<string, unknown> = {}) => ({
  id,
  ts: "2026-02-01T00:00:00.123456+00:00",
  tick_id: 1,
  kind: "thought",
  category: "life",
  text: "the zebra looks calm",
  data: {},
  caused_by: null,
  lang: "en",
  hidden: false,
  ...extra,
});

describe("public API: read only", () => {
  test("only GET, HEAD and OPTIONS; no write route exists", async () => {
    const db = new FakeRpc();
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      const r = await handleApi(get("/api/search?q=x", { method }), mk(db));
      expect(r.status).toBe(405);
    }
    expect(db.calls).toHaveLength(0);
  });
  test("unknown paths and wrong prefixes are 404 and never reach the database", async () => {
    const db = new FakeRpc();
    for (const p of ["/api/nope", "/api/organism", "/api/lab/journal", "/other"]) {
      expect((await handleApi(get(p), mk(db))).status).toBe(404);
    }
    expect(db.calls).toHaveLength(0);
  });
  test("responses carry cache headers per doc 03 and security headers", async () => {
    const db = new FakeRpc({ api_status: { status: "running" }, api_list: [], api_search: [] });
    const status = await handleApi(get("/api/status"), mk(db));
    expect(status.headers.get("cache-control")).toBe("public, max-age=15");
    expect(status.headers.get("x-content-type-options")).toBe("nosniff");
    const search = await handleApi(get("/api/search?q=a"), mk(db));
    expect(search.headers.get("cache-control")).toBe("public, max-age=60");
    const journal = await handleApi(get("/api/journal"), mk(db));
    expect(journal.headers.get("cache-control")).toBe("public, max-age=60");
    const organism = await handleApi(get("/api/lab/organism"), mk(db));
    expect(organism.headers.get("cache-control")).toBe("public, max-age=30");
  });
  test("CORS only for allow-listed origins", async () => {
    const db = new FakeRpc({ api_status: {} });
    const ok = await handleApi(
      get("/api/status", { headers: { origin: "https://truman.pages.dev" } }),
      mk(db),
    );
    expect(ok.headers.get("access-control-allow-origin")).toBe("https://truman.pages.dev");
    const bad = await handleApi(
      get("/api/status", { headers: { origin: "https://evil.test" } }),
      mk(db),
    );
    expect(bad.headers.get("access-control-allow-origin")).toBeNull();
    expect(parseOrigins(" https://a.test/ , ,https://b.test")).toEqual([
      "https://a.test",
      "https://b.test",
    ]);
  });
  test("rate limiting answers 429 with retry-after", async () => {
    const db = new FakeRpc({ api_status: {} });
    const ctx = mk(db, { limiter: new RateLimiter(2, 60_000) });
    const h = { "cf-connecting-ip": "1.2.3.4" };
    expect((await handleApi(get("/api/status", { headers: h }), ctx)).status).toBe(200);
    expect((await handleApi(get("/api/status", { headers: h }), ctx)).status).toBe(200);
    const r = await handleApi(get("/api/status", { headers: h }), ctx);
    expect(r.status).toBe(429);
    expect(Number(r.headers.get("retry-after"))).toBeGreaterThan(0);
    const other = await handleApi(
      get("/api/status", { headers: { "cf-connecting-ip": "9.9.9.9" } }),
      ctx,
    );
    expect(other.status).toBe(200);
  });
  test("errors are generic (no internals leaked) and logged by the caller", async () => {
    const db = new FakeRpc({
      api_status: () => {
        throw new Error("supabase boom");
      },
    });
    const logged: string[] = [];
    const r = await handleApi(get("/api/status"), mk(db), (m) => logged.push(m));
    expect(r.status).toBe(500);
    expect(await r.json()).toEqual({ error: "internal error" });
    expect(logged).toHaveLength(1);
  });
});

describe("search", () => {
  const rows = [entry(9, { rank: 0.9 }), entry(7, { rank: 0.5, text_en: "x" })];
  test("validates parameters and returns a zod-valid page with keyset cursors", async () => {
    const db = new FakeRpc({ api_search: rows });
    const r = await handleApi(
      get("/api/search?q=%20Zebra%20%20Calm&kinds=thought,action&limit=2"),
      mk(db),
    );
    expect(r.status).toBe(200);
    const body = SearchResponse.parse(await r.json());
    expect(body.results).toHaveLength(2);
    expect(body.next_before_id).toBe(7);
    expect(body.next_before_rank).toBe(0.5);
    expect(db.calls[0]!.args).toMatchObject({
      p_q: "zebra calm",
      p_kinds: ["action", "thought"],
      p_lim: 2,
      p_lang: "en",
      p_sort: "relevance",
    });
  });
  test("last page has no cursor", async () => {
    const db = new FakeRpc({ api_search: [entry(3, { rank: 1 })] });
    const r = await handleApi(get("/api/search?q=a&limit=5"), mk(db));
    expect(SearchResponse.parse(await r.json()).next_before_id).toBeNull();
  });
  test.each([
    ["/api/search", "missing q"],
    ["/api/search?q=", "empty q"],
    [`/api/search?q=${"a".repeat(201)}`, "q too long"],
    ["/api/search?q=a&kinds=nonsense", "bad kind"],
    ["/api/search?q=a&limit=101", "limit too big"],
    ["/api/search?q=a&limit=-1", "negative limit"],
    ["/api/search?q=a&lang=fr", "bad lang"],
    ["/api/search?q=a&from=yesterday", "bad date"],
    ["/api/search?q=a&before_id=1;drop", "bad cursor"],
    ["/api/search?q=a&sort=random", "bad sort"],
  ])("%s -> 400 (%s)", async (path) => {
    const db = new FakeRpc({ api_search: [] });
    expect((await handleApi(get(path), mk(db))).status).toBe(400);
    expect(db.calls).toHaveLength(0);
  });
  test("equivalent queries share one cache entry; unknown params cannot bust the cache", async () => {
    const db = new FakeRpc({ api_search: rows });
    const ctx = mk(db);
    await handleApi(get("/api/search?q=Zebra&category=life"), ctx);
    await handleApi(get("/api/search?category=life&q=%20zebra"), ctx);
    await handleApi(get("/api/search?q=zebra&category=life&cachebust=123"), ctx);
    expect(db.count("api_search")).toBe(1);
  });
  test("lang=pt is passed to the database (translated search)", async () => {
    const db = new FakeRpc({ api_search: [] });
    await handleApi(get("/api/search?q=parede&lang=pt&sort=time&before_id=40"), mk(db));
    expect(db.calls[0]!.args).toMatchObject({ p_lang: "pt", p_sort: "time", p_before_id: 40 });
  });
  test("search has its own stricter rate limit", async () => {
    const db = new FakeRpc({ api_search: [] });
    const ctx = mk(db, { searchLimiter: new RateLimiter(1, 60_000) });
    expect((await handleApi(get("/api/search?q=a"), ctx)).status).toBe(200);
    expect((await handleApi(get("/api/search?q=b"), ctx)).status).toBe(429);
    expect((await handleApi(get("/api/status"), ctx)).status).toBe(200);
  });
});

describe("context", () => {
  const view = {
    entry: entry(5),
    causes: [entry(3, { kind: "perception" })],
    consequences: [entry(6, { depth: 1 })],
    body: {
      id: 1,
      ts: "2026-02-01T00:00:00+00:00",
      tick_id: 1,
      organism: {},
      physiology: {},
      emotion_top3: [],
    },
    trace_refs: { llm_traces: [{ id: 1 }], tool_calls: [], decisions: [] },
  };
  test("returns the validated causal chain, cached 60 s", async () => {
    const db = new FakeRpc({ api_context: view });
    const r = await handleApi(get("/api/context/5"), mk(db));
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("public, max-age=60");
    expect(ContextResponse.parse(await r.json()).causes[0]!.kind).toBe("perception");
    expect(db.calls[0]!.args).toEqual({ p_id: 5 });
  });
  test("unknown or hidden entry is 404; bad id never reaches the database; malformed data is a 500", async () => {
    const db = new FakeRpc({ api_context: null });
    expect((await handleApi(get("/api/context/5"), mk(db))).status).toBe(404);
    expect((await handleApi(get("/api/context/abc"), mk(db))).status).toBe(404);
    expect(db.count("api_context")).toBe(1);
    const broken = new FakeRpc({ api_context: { entry: 1 } });
    expect((await handleApi(get("/api/context/9"), mk(broken))).status).toBe(500);
  });
});

describe("lists and lab", () => {
  test("keyset pagination: cursor only when the page is full", async () => {
    const db = new FakeRpc({ api_list: [{ id: 30 }, { id: 29 }] });
    const r = await handleApi(get("/api/journal?limit=2&lang=pt"), mk(db));
    expect(((await r.json()) as { next_before: number }).next_before).toBe(29);
    expect(db.calls[0]!.args).toMatchObject({ p_what: "journal", p_lim: 2, p_lang: "pt" });
    const db2 = new FakeRpc({ api_list: [{ id: 1 }] });
    const r2 = await handleApi(get("/api/lab/decisions?limit=2"), mk(db2));
    expect(((await r2.json()) as { next_before: unknown }).next_before).toBeNull();
  });
  test("every list route maps to its SQL list", async () => {
    const db = new FakeRpc({ api_list: [] });
    const ctx = mk(db);
    for (const p of ["journal", "dreams", "beliefs", "memories", "ideas"]) {
      await handleApi(get(`/api/${p}`), ctx);
    }
    for (const p of ["organism", "appraisals", "decisions", "traces", "tools", "errors"]) {
      await handleApi(get(`/api/lab/${p}?from=2026-01-01T00:00:00Z`), ctx);
    }
    expect(db.calls.map((c) => c.args["p_what"])).toEqual([
      "journal",
      "dreams",
      "beliefs",
      "memories",
      "ideas",
      "organism",
      "appraisals",
      "decisions",
      "traces",
      "tools",
      "errors",
    ]);
  });
  test("log page, trace detail and governor with size mode", async () => {
    const db = new FakeRpc({
      api_log: [entry(11), entry(12)],
      api_trace: { id: 4, response: "full text" },
      api_governor: { mode: "normal", db_size_bytes: 460 * 1024 * 1024, usage: [] },
    });
    const log = await handleApi(get("/api/log?kind=thought&after=10&limit=2"), mk(db));
    expect(((await log.json()) as { next_after: number }).next_after).toBe(12);
    expect((await handleApi(get("/api/lab/traces/4"), mk(db))).status).toBe(200);
    const gov = await handleApi(get("/api/lab/governor"), mk(db));
    expect(((await gov.json()) as { size: { mode: string } }).size.mode).toBe("degraded");
    expect((await handleApi(get("/api/log?kind=bogus"), mk(db))).status).toBe(400);
  });
  test("size governor thresholds: 80% archive, 90% degraded", () => {
    expect(sizeMode(79, 100)).toBe("ok");
    expect(sizeMode(80, 100)).toBe("archive");
    expect(sizeMode(89, 100)).toBe("archive");
    expect(sizeMode(90, 100)).toBe("degraded");
    expect(sizeReport(50, 100).pct).toBe(50);
  });
});

describe("translation cache", () => {
  const ok: Translator = { engine: "fake", translate: async (t) => `PT(${t})` };
  const bad: Translator = {
    engine: "bad",
    translate: async () => {
      throw new Error("down");
    },
  };
  const q = "/api/translate?entity=log_entries&id=7&lang=pt";
  const miss = { translation_lookup: { source: "hello", translated: null, engine: null } };
  test("cache hit never calls an engine or spends budget", async () => {
    const db = new FakeRpc({
      translation_lookup: { source: "hello", translated: "ola", engine: "x" },
    });
    const r = await handleApi(get(q), mk(db, { translators: [ok] }));
    expect(await r.json()).toMatchObject({ text: "ola", cached: true });
    expect(db.count("usage_try")).toBe(0);
    expect(r.headers.get("cache-control")).toBe("public, max-age=86400");
  });
  test("miss: translate once, store, then the edge cache serves it", async () => {
    const db = new FakeRpc({ ...miss, usage_try: true, translation_put: true });
    const ctx = mk(db, { translators: [ok] });
    const first = await handleApi(get(q), ctx);
    expect(await first.json()).toMatchObject({ text: "PT(hello)", engine: "fake", cached: false });
    expect(db.calls.find((c) => c.name === "translation_put")!.args).toMatchObject({
      p_text: "PT(hello)",
      p_lang: "pt",
    });
    await handleApi(get(q), ctx);
    expect(db.count("translation_lookup")).toBe(1);
  });
  test("daily cap, missing source, no engine, engine failure, bad params", async () => {
    const capped = mk(new FakeRpc({ ...miss, usage_try: false }), { translators: [ok] });
    expect((await handleApi(get(q), capped)).status).toBe(429);
    const none = mk(new FakeRpc({ translation_lookup: { source: null, translated: null } }), {
      translators: [ok],
    });
    expect((await handleApi(get(q), none)).status).toBe(404);
    expect((await handleApi(get(q), mk(new FakeRpc(miss), { translators: [] }))).status).toBe(503);
    const failing = mk(new FakeRpc({ ...miss, usage_try: true }), { translators: [bad] });
    expect((await handleApi(get(q), failing)).status).toBe(502);
    expect(
      (await handleApi(get("/api/translate?entity=kv&id=1&lang=pt"), mk(new FakeRpc()))).status,
    ).toBe(400);
    expect(
      (await handleApi(get("/api/translate?entity=journal&id=1&lang=fr"), mk(new FakeRpc())))
        .status,
    ).toBe(400);
  });
  test("fallback order, chunking and MyMemory quota warnings", async () => {
    expect(await translateWithFallback([bad, ok], "hi")).toEqual({
      text: "PT(hi)",
      engine: "fake",
    });
    await expect(translateWithFallback([bad], "hi")).rejects.toThrow(/bad: down/);
    expect(chunkText("One. Two. Three.", 10).every((c) => c.length <= 10)).toBe(true);
    expect(chunkText("a".repeat(1000), 450).length).toBe(3);
    const reply = (t: string) => async () =>
      new Response(JSON.stringify({ responseStatus: 200, responseData: { translatedText: t } }));
    const warn = new MyMemoryTranslator(
      reply("MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS"),
    );
    await expect(warn.translate("hello")).rejects.toThrow();
    expect(await new MyMemoryTranslator(reply("ola")).translate("hello")).toBe("ola");
  });
});

describe("admin", () => {
  const auth = { authorization: `Bearer ${TOKEN}` };
  const post = (p: string, h: Record<string, string> = auth) =>
    get(p, { method: "POST", headers: h });
  test("disabled without a strong token", async () => {
    const off = mk(new FakeRpc(), { adminToken: undefined });
    expect((await handleApi(post("/admin/pause"), off)).status).toBe(404);
    const weak = mk(new FakeRpc(), { adminToken: "short" });
    expect(
      (await handleApi(post("/admin/pause", { authorization: "Bearer short" }), weak)).status,
    ).toBe(404);
  });
  test("401 without or with a wrong token; token in the query string is never accepted", async () => {
    const db = new FakeRpc();
    const ctx = mk(db);
    expect((await handleApi(post("/admin/pause", {}), ctx)).status).toBe(401);
    expect(
      (await handleApi(post("/admin/pause", { authorization: "Bearer nope" }), ctx)).status,
    ).toBe(401);
    expect((await handleApi(get(`/admin/export?token=${TOKEN}`), ctx)).status).toBe(401);
    expect(db.calls).toHaveLength(0);
  });
  test("lockout after repeated failures, even for the right token", async () => {
    const ctx = mk(new FakeRpc());
    const h = { "cf-connecting-ip": "6.6.6.6" };
    for (let i = 0; i < 6; i++) {
      await handleApi(post("/admin/pause", { ...h, authorization: "Bearer wrong" }), ctx);
    }
    expect((await handleApi(post("/admin/pause", { ...h, ...auth }), ctx)).status).toBe(429);
  });
  test("pause, resume, kill flip the gate flags; tick runs a tick", async () => {
    const db = new FakeRpc();
    let ticks = 0;
    const ctx = mk(db, { runTick: async () => ({ n: ++ticks }) });
    expect((await handleApi(post("/admin/pause"), ctx)).status).toBe(200);
    expect((await handleApi(post("/admin/kill"), ctx)).status).toBe(200);
    expect((await handleApi(post("/admin/resume"), ctx)).status).toBe(200);
    expect((await handleApi(post("/admin/tick"), ctx)).status).toBe(200);
    expect(ticks).toBe(1);
    expect(db.calls.map((c) => `${c.args["p_key"]}=${c.args["p_value"]}`)).toEqual([
      "paused=true",
      "kill_switch=true",
      "paused=false",
      "kill_switch=false",
    ]);
  });
  test("hide and unhide only flip the flag; there is no delete route", async () => {
    const db = new FakeRpc({ admin_hide: true });
    const ctx = mk(db);
    expect(await (await handleApi(post("/admin/hide/42"), ctx)).json()).toMatchObject({
      action: "hide",
      id: 42,
    });
    await handleApi(post("/admin/unhide/42"), ctx);
    expect(db.calls.map((c) => [c.name, c.args["p_hidden"]])).toEqual([
      ["admin_hide", true],
      ["admin_hide", false],
    ]);
    for (const m of ["DELETE", "PUT", "PATCH"]) {
      expect(
        (await handleApi(get("/admin/hide/42", { method: m, headers: auth }), ctx)).status,
      ).toBe(405);
    }
    expect((await handleApi(post("/admin/delete/42"), ctx)).status).toBe(404);
    expect(db.calls.every((c) => c.name === "admin_hide")).toBe(true);
    expect(
      (await handleApi(post("/admin/hide/9"), mk(new FakeRpc({ admin_hide: false })))).status,
    ).toBe(404);
  });
  test("export pages include everything and are never cached", async () => {
    const db = new FakeRpc({ admin_export: [entry(1, { hidden: true }), entry(2)] });
    const r = await handleApi(get("/admin/export?after=0&limit=2", { headers: auth }), mk(db));
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(((await r.json()) as { next_after: number }).next_after).toBe(2);
  });
});
