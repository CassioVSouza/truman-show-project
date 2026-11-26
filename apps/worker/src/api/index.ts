// Read-only public API (GET) and token-protected admin routes. Supabase is reached ONLY from here, with the service key.
// Free-tier notes (doc 05): every request counts against the 100k/day Worker quota, whether cached or not. The edge cache
// protects Supabase egress and CPU, NOT the request quota; the live feed must come from static snapshot files (decision 22/23).
import { ContextResponse, LogKind } from "@truman/contracts";
import { z } from "zod";
import { sizeReport } from "../governor/size";
import type { StartResult } from "../tick/start";
import {
  RateLimiter,
  defaultEdgeCache,
  errorJson,
  json,
  safeEqual,
  withCors,
  type ApiEnv,
  type EdgeCache,
} from "./http";
import { MAX_TRANSLATE_CHARS, translateWithFallback, type Translator } from "./translate";

export interface Rpc {
  rpc(name: string, args?: Record<string, unknown>): Promise<unknown>;
}

export interface ApiContext {
  db: Rpc;
  env: ApiEnv;
  adminToken?: string;
  translators: Translator[];
  /** Max server-side translations per UTC day (Workers AI / MyMemory are quota-limited). */
  translateDayCap: number;
  /** Runs one tick now (admin). */
  runTick: () => Promise<unknown>;
  startResident: () => Promise<StartResult>;
  cache?: EdgeCache | null;
  now?: () => number;
  limiter?: RateLimiter;
  searchLimiter?: RateLimiter;
  adminFailures?: RateLimiter;
  beatLimiter?: RateLimiter;
}

// Per-isolate state (best effort). Real flood control = a Cloudflare rate-limit rule in front of the Worker.
const defaultLimiter = new RateLimiter(120, 60_000);
const defaultSearchLimiter = new RateLimiter(20, 60_000);
const defaultAdminFailures = new RateLimiter(5, 15 * 60_000);

const num = z
  .string()
  .regex(/^\d{1,15}$/)
  .transform(Number);
const limit = num.pipe(z.number().int().min(1).max(100)).optional();
const iso = z.string().datetime({ offset: true });
const lang = z.enum(["en", "pt"]).default("en");

// Unknown query params are dropped by zod (strip), so they can never be used to bust the cache.
const SearchQuery = z.object({
  q: z
    .string()
    .transform((s) => s.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase())
    .pipe(z.string().min(1).max(200)),
  kinds: z
    .string()
    .transform((s) => s.split(",").filter(Boolean).sort())
    .pipe(z.array(LogKind).max(30))
    .optional(),
  category: z.enum(["life", "lab"]).optional(),
  from: iso.optional(),
  to: iso.optional(),
  lang,
  sort: z.enum(["relevance", "time"]).default("relevance"),
  before_id: num.optional(),
  before_rank: z
    .string()
    .regex(/^-?\d{1,6}(\.\d{1,17})?(e-?\d{1,3})?$/i)
    .transform(Number)
    .optional(),
  limit,
});
const LogQuery = z.object({
  kind: LogKind.optional(),
  category: z.enum(["life", "lab"]).optional(),
  after: num.optional(),
  limit,
});
const ListQuery = z.object({
  before: num.optional(),
  limit,
  lang,
  from: iso.optional(),
  to: iso.optional(),
});
const TranslateQuery = z.object({
  entity: z.enum(["log_entries", "journal", "dreams", "beliefs", "memories"]),
  id: num,
  lang: z.literal("pt"),
});

const LISTS: Record<string, { what: string; ttl: number; lab: boolean }> = {
  journal: { what: "journal", ttl: 60, lab: false },
  dreams: { what: "dreams", ttl: 60, lab: false },
  beliefs: { what: "beliefs", ttl: 60, lab: false },
  memories: { what: "memories", ttl: 60, lab: false },
  ideas: { what: "ideas", ttl: 60, lab: false },
  organism: { what: "organism", ttl: 30, lab: true },
  appraisals: { what: "appraisals", ttl: 30, lab: true },
  decisions: { what: "decisions", ttl: 30, lab: true },
  traces: { what: "traces", ttl: 30, lab: true },
  tools: { what: "tools", ttl: 30, lab: true },
  errors: { what: "errors", ttl: 30, lab: true },
};

const queryObject = (url: URL): Record<string, string> => {
  const o: Record<string, string> = {};
  for (const [k, v] of url.searchParams) if (!(k in o)) o[k] = v; // first value wins
  return o;
};

/** Canonical cache key: only validated, normalised parameters, sorted. */
function cacheKey(path: string, parsed: Record<string, unknown>): string {
  const parts = Object.entries(parsed)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => [k, Array.isArray(v) ? v.join(",") : String(v)] as const)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  return `${path}?${parts.join("&")}`;
}

const clientKey = (req: Request) => req.headers.get("cf-connecting-ip") ?? "anon";
const rows = (v: unknown): Array<Record<string, unknown>> =>
  Array.isArray(v) ? (v as Array<Record<string, unknown>>) : [];

type Handler = () => Promise<Response>;

// Live viewers count (decision 42). Body = random per-browser token (text/plain, so no CORS preflight). Only its SHA-256 is stored.
export const VIEWER_BEAT_PATH = "/api/viewers/beat";
const VIEWER_WINDOW_SECONDS = 120;
const defaultBeatLimiter = new RateLimiter(6, 60_000); // heartbeat is ~1/min; 6/min/IP leaves room for a few tabs

async function viewerBeat(req: Request, ctx: ApiContext): Promise<Response> {
  const wait = (ctx.beatLimiter ?? defaultBeatLimiter).hit(
    `b:${clientKey(req)}`,
    ctx.now?.() ?? Date.now(),
  );
  if (wait > 0) return errorJson(429, "too many requests", { "retry-after": String(wait) });
  const raw = (await req.text()).slice(0, 129);
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(raw)) return errorJson(400, "invalid token");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`viewer:${raw}`));
  const token_hash = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  const n = await ctx.db.rpc("api_viewer_beat", {
    p_token_hash: token_hash,
    p_window_seconds: VIEWER_WINDOW_SECONDS,
  });
  const viewers = typeof n === "number" && Number.isFinite(n) ? Math.max(1, Math.trunc(n)) : 1;
  return json({ viewers }, 200, 0);
}

/** Entry point. Never throws: unexpected errors become a generic 500 (details only in the Worker log, already redacted). */
export async function handleApi(
  req: Request,
  ctx: ApiContext,
  logError: (m: string) => void = () => {},
): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  try {
    if (path.startsWith("/admin/")) return await handleAdmin(req, url, path, ctx);
    if (!path.startsWith("/api/")) return errorJson(404, "not found");
    if (req.method === "OPTIONS")
      return withCors(new Response(null, { status: 204 }), req, ctx.env);
    // The ONLY public write: an anonymous presence heartbeat (decision 42). It touches viewer_presence, never the log.
    if (path === VIEWER_BEAT_PATH && req.method === "POST")
      return withCors(await viewerBeat(req, ctx), req, ctx.env);
    if (req.method !== "GET" && req.method !== "HEAD") {
      return errorJson(405, "read only", { allow: "GET, OPTIONS" });
    }
    const res = await handlePublic(req, url, path, ctx);
    return withCors(req.method === "HEAD" ? new Response(null, res) : res, req, ctx.env);
  } catch (e) {
    logError(`api error on ${path}: ${e instanceof Error ? e.message : String(e)}`);
    return withCors(errorJson(500, "internal error"), req, ctx.env);
  }
}

async function handlePublic(
  req: Request,
  url: URL,
  path: string,
  ctx: ApiContext,
): Promise<Response> {
  const now = ctx.now?.() ?? Date.now();
  const heavy = path === "/api/search" || path === "/api/translate";
  const wait = (
    heavy ? (ctx.searchLimiter ?? defaultSearchLimiter) : (ctx.limiter ?? defaultLimiter)
  ).hit(`${heavy ? "s" : "g"}:${clientKey(req)}`, now);
  if (wait > 0) return errorJson(429, "too many requests", { "retry-after": String(wait) });

  const q = queryObject(url);
  const cached = async (key: string, ttl: number, produce: Handler): Promise<Response> => {
    const cache = ctx.cache === undefined ? defaultEdgeCache() : ctx.cache;
    const hit = await cache?.match(key);
    if (hit) return hit;
    const res = await produce();
    if (res.status === 200 && cache) await cache.put(key, res.clone());
    return res;
  };
  const bad = (e: z.ZodError) =>
    errorJson(400, `invalid query: ${e.issues[0]?.path.join(".") || "?"}`);

  if (path === "/api/status") {
    return cached("/api/status", 15, async () => json(await ctx.db.rpc("api_status"), 200, 15));
  }

  if (path === "/api/search") {
    const p = SearchQuery.safeParse(q);
    if (!p.success) return bad(p.error);
    const v = p.data;
    const lim = v.limit ?? 30;
    return cached(cacheKey(path, v), 60, async () => {
      const out = rows(
        await ctx.db.rpc("api_search", {
          p_q: v.q,
          p_lang: v.lang,
          p_kinds: v.kinds ?? null,
          p_cat: v.category ?? null,
          p_from: v.from ?? null,
          p_to: v.to ?? null,
          p_lim: lim,
          p_before_id: v.before_id ?? null,
          p_before_rank: v.before_rank ?? null,
          p_sort: v.sort,
        }),
      );
      const last = out[out.length - 1];
      const more = out.length === lim && last !== undefined;
      return json(
        {
          results: out,
          next_before_id: more ? last["id"] : null,
          next_before_rank: more ? last["rank"] : null,
        },
        200,
        60,
      );
    });
  }

  if (path === "/api/log") {
    const p = LogQuery.safeParse(q);
    if (!p.success) return bad(p.error);
    const v = p.data;
    const lim = v.limit ?? 50;
    return cached(cacheKey(path, v), 15, async () => {
      const out = rows(
        await ctx.db.rpc("api_log", {
          p_kind: v.kind ?? null,
          p_cat: v.category ?? null,
          p_after: v.after ?? 0,
          p_lim: lim,
        }),
      );
      const last = out[out.length - 1];
      return json(
        { items: out, next_after: out.length === lim && last ? last["id"] : null },
        200,
        15,
      );
    });
  }

  const ctxMatch = /^\/api\/context\/(\d{1,15})$/.exec(path);
  if (ctxMatch) {
    const id = Number(ctxMatch[1]);
    return cached(`/api/context/${id}`, 60, async () => {
      const r = await ctx.db.rpc("api_context", { p_id: id });
      if (r === null || r === undefined) return errorJson(404, "no such entry");
      const parsed = ContextResponse.safeParse(r);
      if (!parsed.success) throw new Error("context response failed validation");
      return json(parsed.data, 200, 60);
    });
  }

  const traceMatch = /^\/api\/lab\/traces\/(\d{1,15})$/.exec(path);
  if (traceMatch) {
    const id = Number(traceMatch[1]);
    return cached(path, 300, async () => {
      const r = await ctx.db.rpc("api_trace", { p_id: id });
      return r ? json(r, 200, 300) : errorJson(404, "no such trace");
    });
  }

  if (path === "/api/lab/governor") {
    return cached(path, 30, async () => {
      const g = (await ctx.db.rpc("api_governor")) as Record<string, unknown> | null;
      const bytes = Number(g?.["db_size_bytes"] ?? 0);
      return json({ ...g, size: sizeReport(bytes) }, 200, 30);
    });
  }

  const listMatch = /^\/api\/(?:lab\/)?([a-z]+)$/.exec(path);
  const def = listMatch ? LISTS[listMatch[1] as string] : undefined;
  if (def && path.startsWith("/api/lab/") === def.lab) {
    const p = ListQuery.safeParse(q);
    if (!p.success) return bad(p.error);
    const v = p.data;
    const lim = v.limit ?? 30;
    return cached(cacheKey(path, v), def.ttl, async () => {
      const out = rows(
        await ctx.db.rpc("api_list", {
          p_what: def.what,
          p_before: v.before ?? null,
          p_lim: lim,
          p_lang: v.lang,
          p_from: v.from ?? null,
          p_to: v.to ?? null,
        }),
      );
      const last = out[out.length - 1];
      return json(
        { items: out, next_before: out.length === lim && last ? last["id"] : null },
        200,
        def.ttl,
      );
    });
  }

  if (path === "/api/translate") {
    const p = TranslateQuery.safeParse(q);
    if (!p.success) return bad(p.error);
    const v = p.data;
    return cached(cacheKey(path, v), 86400, () => translateRoute(ctx, v.entity, v.id, v.lang));
  }

  return errorJson(404, "not found");
}

async function translateRoute(
  ctx: ApiContext,
  entity: string,
  id: number,
  lang: "pt",
): Promise<Response> {
  const got = (await ctx.db.rpc("translation_lookup", {
    p_entity: entity,
    p_id: id,
    p_lang: lang,
  })) as { source: string | null; translated: string | null; engine: string | null } | null;
  if (!got || got.source === null) return errorJson(404, "nothing to translate");
  if (got.translated !== null) {
    return json(
      { entity, id, lang, text: got.translated, engine: got.engine ?? "cache", cached: true },
      200,
      86400,
    );
  }
  if (got.source.length > MAX_TRANSLATE_CHARS)
    return errorJson(422, "text too long for server translation");
  if (ctx.translators.length === 0) return errorJson(503, "server translation not configured");
  const allowed = await ctx.db.rpc("usage_try", {
    p_tool: "translate_server",
    p_cap: ctx.translateDayCap,
  });
  if (allowed !== true)
    return errorJson(429, "daily server translation budget used", { "retry-after": "3600" });
  let t: { text: string; engine: string };
  try {
    t = await translateWithFallback(ctx.translators, got.source);
  } catch {
    return errorJson(502, "translation unavailable");
  }
  await ctx.db.rpc("translation_put", {
    p_entity: entity,
    p_id: id,
    p_lang: lang,
    p_text: t.text,
    p_engine: t.engine,
  });
  return json({ entity, id, lang, text: t.text, engine: t.engine, cached: false }, 200, 86400);
}

// ---------------------------------------------------------------------------------------------------------------------
// Admin: Authorization: Bearer <ADMIN_TOKEN> only (never a query string), constant-time compare, failure rate limit.
// hide/unhide flip a flag and append an audit entry in one SQL transaction; nothing is ever deleted.
async function handleAdmin(
  req: Request,
  url: URL,
  path: string,
  ctx: ApiContext,
): Promise<Response> {
  const noStore = { "cache-control": "no-store" };
  if (!ctx.adminToken || ctx.adminToken.length < 16) return errorJson(404, "not found"); // disabled until a strong token is set
  const failures = ctx.adminFailures ?? defaultAdminFailures;
  const key = clientKey(req);
  const now = ctx.now?.() ?? Date.now();
  const wait = failures.blocked(key, now);
  if (wait > 0)
    return errorJson(429, "too many failed attempts", { "retry-after": String(wait), ...noStore });

  const m = /^Bearer (.+)$/.exec(req.headers.get("authorization") ?? "");
  if (!m || !(await safeEqual(m[1] as string, ctx.adminToken))) {
    failures.hit(key, now);
    return errorJson(401, "unauthorized", { "www-authenticate": "Bearer", ...noStore });
  }
  if (url.search !== "" && path !== "/admin/export") return errorJson(400, "no query parameters");

  const post = req.method === "POST";
  const sub = path.slice("/admin/".length);
  if (sub === "export" && req.method === "GET") {
    const p = z
      .object({
        after: num.optional(),
        limit: num.pipe(z.number().int().min(1).max(1000)).optional(),
      })
      .safeParse(queryObject(url));
    if (!p.success) return errorJson(400, "invalid query");
    const items = rows(
      await ctx.db.rpc("admin_export", { p_after: p.data.after ?? 0, p_lim: p.data.limit ?? 500 }),
    );
    const last = items[items.length - 1];
    return json({ items, next_after: last ? last["id"] : null }, 200, 0);
  }
  if (!post) return errorJson(405, "method not allowed", { allow: "POST", ...noStore });

  switch (sub) {
    case "start": {
      const result = await ctx.startResident();
      if (result === "busy") return errorJson(409, "tick lease is busy", noStore);
      if (result === "already_started") return errorJson(409, "resident already exists", noStore);
      return json({ ok: true, action: sub }, 201);
    }
    case "pause":
    case "kill":
      await ctx.db.rpc("admin_set_flag", {
        p_action: sub,
        p_key: sub === "pause" ? "paused" : "kill_switch",
        p_value: true,
      });
      return json({ ok: true, action: sub });
    case "resume":
      await ctx.db.rpc("admin_set_flag", { p_action: "resume", p_key: "paused", p_value: false });
      await ctx.db.rpc("admin_set_flag", {
        p_action: "resume",
        p_key: "kill_switch",
        p_value: false,
      });
      return json({ ok: true, action: "resume" });
    case "tick":
      return json({ ok: true, result: await ctx.runTick() });
  }
  const h = /^(hide|unhide)\/(\d{1,15})$/.exec(sub);
  if (h) {
    const ok = await ctx.db.rpc("admin_hide", { p_id: Number(h[2]), p_hidden: h[1] === "hide" });
    return ok === true
      ? json({ ok: true, action: h[1], id: Number(h[2]) })
      : errorJson(404, "no such entry");
  }
  return errorJson(404, "not found");
}
