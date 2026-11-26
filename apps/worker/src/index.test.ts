import { describe, expect, test } from "vitest";
import worker from "./index";
import { FakeDb } from "./db/fake";
import { SupabaseDb } from "./db/supabase";
import { readConfig, redact, redactValue } from "./env";
import { runTick } from "./tick";
import { gate } from "./governor";
import { measureCpu, WORKERS_FREE_CPU_MS } from "./perf/cpu";

const cfg = {
  supabaseUrl: "https://example.test",
  supabaseServiceKey: "test-key-not-real-service",
};

test("worker scaffold responds", async () => {
  expect(await (await worker.fetch()).text()).toBe("ok");
});

describe("env", () => {
  test("missing vars are named, values never echoed", () => {
    expect(() => readConfig({})).toThrow(/SUPABASE_URL, SUPABASE_SERVICE_KEY/);
    expect(() =>
      readConfig({ SUPABASE_URL: "http://evil.test", SUPABASE_SERVICE_KEY: "test-key-not-real" }),
    ).toThrow(/https/);
  });
  test("redact strips secret values", () => {
    const env = {
      SUPABASE_URL: "https://x.test",
      SUPABASE_SERVICE_KEY: "test-key-not-real-service",
    };
    expect(redact("boom test-key-not-real-service end", env)).toBe("boom [redacted] end");
  });
  test("redact catches the key inside an error, JSON-escaped, URL-encoded and base64", () => {
    const key = 'test-key-not-real "q"/\\+&=';
    const env = { SUPABASE_URL: "https://x.test", SUPABASE_SERVICE_KEY: key };
    expect(redact(new Error(`upstream said ${key}`).message, env)).not.toContain(key);
    const json = JSON.stringify(key).slice(1, -1);
    expect(redact(`{"detail":"k=${json}"}`, env)).not.toContain(json);
    const enc = encodeURIComponent(key);
    expect(redact(`GET /x?apikey=${enc}`, env)).not.toContain(enc);
    expect(redact(`auth ${btoa(key)}`, env)).not.toContain(btoa(key));
    expect(redact(`${key} and ${key}`, env)).toBe("[redacted] and [redacted]");
  });
});

describe("empty tick", () => {
  const t = () => new Date("2026-11-25T12:00:00Z");
  test("one load and exactly one commit", async () => {
    const db = new FakeDb();
    const r = await runTick(db, t);
    expect(db.loads).toBe(1);
    expect(db.commits).toHaveLength(1);
    expect(db.commits[0]!.tick.mode).toBe("idle");
    expect(db.commits[0]!.log_entries).toHaveLength(1);
    expect(r).toMatchObject({ ran: true, tick_id: 1 });
  });
  test("kill switch, pause, dead, missing resident skip but still log the tick", async () => {
    for (const [kv, res, why] of [
      [{ kill_switch: true }, { id: 1 }, "kill_switch"],
      [{ paused: true }, { id: 1 }, "paused"],
      [{}, { id: 1, status: "dead" }, "dead"],
      [{}, null, "no_resident"],
    ] as const) {
      const db = new FakeDb({ resident: res, kv });
      const r = await runTick(db, t);
      expect(r.reason).toBe(why);
      expect(db.commits[0]!.tick.mode).toBe("skipped");
      expect(db.commits[0]!.log_entries).toEqual([
        { kind: "tick", category: "lab", text: `tick skipped: ${why}`, data: { mode: "skipped" } },
      ]);
      expect(db.commits[0]!.resident).toBeUndefined();
    }
  });
  test("kill/pause flags are coerced and fail closed", () => {
    const run = (kv: Record<string, unknown>) => gate(kv, { status: "running" }).run;
    for (const v of [true, 1, "1", "true", "TRUE", " true ", "yes", "on", "garbage", {}, [], 2])
      expect([v, run({ kill_switch: v })]).toEqual([v, false]);
    for (const v of [true, 1, "1", "true"]) expect(run({ paused: v })).toBe(false);
    for (const v of [false, 0, "0", "false", "", null, undefined, "off"])
      expect([v, run({ kill_switch: v, paused: v })]).toEqual([v, true]);
    expect(run({})).toBe(true);
  });
  test("a failed tick writes one minimal failed row via a single commit, never loops", async () => {
    const db = new FakeDb();
    db.loadState = async () => {
      throw new Error("boom sk-key-not-real-xyz");
    };
    await expect(
      runTick(db, t, (m) => m.replace("sk-key-not-real-xyz", "[redacted]")),
    ).rejects.toThrow(/boom/);
    expect(db.commits).toHaveLength(1);
    expect(db.commits[0]!.tick).toMatchObject({ ok: false, mode: "failed", provider: null });
    expect(db.commits[0]!.tick.error).toBe("boom [redacted]");
    expect(db.commits[0]!.log_entries![0]!.text).toBe("tick failed: boom [redacted]");
  });
  test("if the failure row cannot be written, the original error surfaces (no loop)", async () => {
    const db = new FakeDb();
    let commits = 0;
    db.loadState = async () => {
      throw new Error("first");
    };
    db.commitTick = async () => {
      commits++;
      throw new Error("second");
    };
    await expect(runTick(db, t)).rejects.toThrow("first");
    expect(commits).toBe(1);
  });
  test("gate is pure", () => {
    expect(gate({}, { status: "running" })).toEqual({ run: true });
  });
});

describe("SupabaseDb over fake fetch", () => {
  function mk(cap?: number) {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const f = async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      if (url.includes("/resident"))
        return new Response(JSON.stringify([{ id: 1, status: "running" }]));
      if (url.includes("/kv"))
        return new Response(JSON.stringify([{ key: "paused", value: false }]));
      if (url.includes("/rpc/tick_commit"))
        return new Response(JSON.stringify({ tick_id: 7, log_ids: {} }));
      return new Response("nope", { status: 500 });
    };
    return { db: new SupabaseDb(cfg, f, cap), calls };
  }
  test("a whole tick uses 3 subrequests: load x2, commit x1", async () => {
    const { db, calls } = mk();
    const r = await runTick(db);
    expect(r.tick_id).toBe(7);
    expect(db.subrequests).toBe(3);
    expect(calls.filter((c) => c.url.includes("tick_commit"))).toHaveLength(1);
    expect(calls[0]!.init!.headers).toMatchObject({ apikey: cfg.supabaseServiceKey });
  });
  test("cap is enforced", async () => {
    const { db } = mk(1);
    await expect(db.loadState()).rejects.toThrow(/subrequest budget/);
  });
  test("error messages never contain the key", async () => {
    const db = new SupabaseDb(
      cfg,
      async () => new Response(`bad ${cfg.supabaseServiceKey}`, { status: 401 }),
    );
    const e = await db
      .commitTick({
        tick: { started_at: "", ended_at: "", mode: "x", provider: null, ok: true, error: null },
      })
      .catch((x: Error) => x);
    expect((e as Error).message).not.toContain(cfg.supabaseServiceKey);
  });
});

describe("SupabaseDb hardening", () => {
  test("every request carries an abort signal and honours the configured timeout", async () => {
    let signal: AbortSignal | undefined;
    const db = new SupabaseDb({ ...cfg, fetchTimeoutMs: 20 }, async (_u, init) => {
      signal = init!.signal as AbortSignal;
      return new Promise<Response>((_res, rej) =>
        signal!.addEventListener("abort", () =>
          rej(new Error(`aborted ${cfg.supabaseServiceKey}`)),
        ),
      );
    });
    const e = await db.loadState().catch((x: Error) => x);
    expect(signal).toBeInstanceOf(AbortSignal);
    await new Promise((r) => setTimeout(r, 40));
    expect(signal!.aborted).toBe(true);
    expect((e as Error).message).toMatch(/request failed/);
    expect((e as Error).message).not.toContain(cfg.supabaseServiceKey);
  });
  test("default timeout is 8s; SUPABASE_FETCH_TIMEOUT_MS overrides; junk falls back", () => {
    const base = { SUPABASE_URL: "https://x.test", SUPABASE_SERVICE_KEY: "test-key-not-real-1" };
    expect(readConfig(base).fetchTimeoutMs).toBe(8000);
    expect(readConfig({ ...base, SUPABASE_FETCH_TIMEOUT_MS: "1500" }).fetchTimeoutMs).toBe(1500);
    expect(readConfig({ ...base, SUPABASE_FETCH_TIMEOUT_MS: "junk" }).fetchTimeoutMs).toBe(8000);
  });
  test("key echoed in an error body is redacted when URL-encoded and across the 200 char cut", async () => {
    const key = "test-key-not-real/slash+plus";
    const db = new SupabaseDb(
      { ...cfg, supabaseServiceKey: key },
      async () => new Response(`${"x".repeat(180)}${encodeURIComponent(key)}`, { status: 400 }),
    );
    const e = (await db.loadState().catch((x: Error) => x)) as Error;
    expect(e.message).not.toContain(encodeURIComponent(key));
    expect(e.message).not.toContain(key);
  });
});

describe("scheduled handler", () => {
  test("misconfigured env logs a redacted error and does not throw", async () => {
    await expect(
      worker.scheduled({}, { SUPABASE_URL: "", SUPABASE_SERVICE_KEY: "" }),
    ).resolves.toBeUndefined();
  });
});

describe("CPU harness (Phase 0 spike stub)", () => {
  test("measures an empty tick against FakeDb; Node numbers are a proxy only", async () => {
    const stats = await measureCpu(() => runTick(new FakeDb()), 30, 3);
    console.log(
      `empty tick CPU (Node proxy, budget ${WORKERS_FREE_CPU_MS} ms): p50=${stats.p50.toFixed(3)} p95=${stats.p95.toFixed(3)} max=${stats.max.toFixed(3)} via ${stats.source}`,
    );
    expect(stats.runs).toBe(30);
    expect(stats.p50).toBeLessThanOrEqual(stats.p95);
    expect(stats.p95).toBeLessThanOrEqual(stats.max);
  });
});

describe("decision 24 re-check hardening", () => {
  const base = { SUPABASE_SERVICE_KEY: "test-key-not-real-1" };
  test("readConfig: exact localhost host; look-alike hosts and userinfo tricks rejected", () => {
    const ok = (u: string) => readConfig({ ...base, SUPABASE_URL: u }).supabaseUrl;
    expect(ok("http://localhost:54321")).toBe("http://localhost:54321");
    expect(ok("https://abc.supabase.co/")).toBe("https://abc.supabase.co");
    for (const u of [
      "http://localhost.evil.com",
      "http://localhost@evil.com",
      "http://localhostevil.com",
      "http://evil.com/localhost",
      "http://evil.test",
      "ftp://localhost",
      "not a url",
      "https//x",
    ])
      expect(() => readConfig({ ...base, SUPABASE_URL: u }), u).toThrow(/https/);
  });
  test("timeout is clamped to a finite sane range", () => {
    const t = (v: string) =>
      readConfig({ ...base, SUPABASE_URL: "https://x.test", SUPABASE_FETCH_TIMEOUT_MS: v })
        .fetchTimeoutMs;
    for (const v of ["Infinity", "NaN", "-5", "0", ""]) expect(t(v), v).toBe(8000);
    expect(t("1")).toBe(500);
    expect(t("99999999")).toBe(25000);
    expect(t("3000")).toBe(3000);
  });
  test("redactValue: base64url, percent hex case, base64 at offsets 0/1/2", () => {
    const key = 'test-key-not-real?>"/+=~ zz';
    const b64 = (s: string) => btoa(s);
    const url = (s: string) => b64(s).replace(/\+/g, "-").replace(/\//g, "_");
    const pct = encodeURIComponent(key);
    const lowerPct = pct.replace(/%[0-9A-F]{2}/g, (m) => m.toLowerCase());
    let n = 0;
    const mixedPct = pct.replace(/%[0-9A-F]{2}/g, (m) => (n++ % 2 ? m.toLowerCase() : m));
    for (const leak of [url(key), url(key).replace(/=+$/, ""), lowerPct, mixedPct, pct])
      expect(redactValue(`x ${leak} y`, key), leak).not.toContain(leak);
    // embedded in a longer base64 payload at each of the three alignments
    for (const pre of ["", "a", "ab"]) {
      for (const post of ["", "z", "zz"]) {
        for (const f of [b64, url]) {
          const enc = f(`${pre}${key}${post}`).replace(/=+$/, "");
          const out = redactValue(`token=${enc};`, key);
          expect(out, `${pre}|${post}`).toContain("[redacted]");
          expect(out.length, `${pre}|${post}`).toBeLessThan(enc.length);
        }
      }
    }
  });
  test("one subrequest is kept in reserve for the failed-tick row", async () => {
    const seen: string[] = [];
    const f = async (url: string, init?: RequestInit) => {
      seen.push(url.includes("tick_commit") ? `${url} ${String(init?.body)}` : url);
      if (url.includes("/rpc/tick_commit"))
        return new Response(JSON.stringify({ tick_id: 9, log_ids: {} }));
      return new Response(JSON.stringify([]));
    };
    const db = new SupabaseDb(cfg, f, 2); // loadState needs 2 calls, normal limit is 1
    await expect(runTick(db)).rejects.toThrow(/subrequest budget/);
    const commits = seen.filter((u) => u.includes("tick_commit"));
    expect(commits).toHaveLength(1);
    expect(commits[0]).toContain('"mode":"failed"');
    expect(db.subrequests).toBeLessThanOrEqual(2);
  });
});
