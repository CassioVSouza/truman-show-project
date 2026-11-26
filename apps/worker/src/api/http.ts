// HTTP helpers for the public read API: JSON responses, CORS allow-list, edge cache, per-isolate rate limiter.
// Public routes are GET only, take no cookies, and read only validated query parameters.

export interface ApiEnv {
  /** Comma-separated exact origins allowed to read the API from a browser (e.g. the Pages URL). Empty = no CORS. */
  allowedOrigins: string[];
}

export const parseOrigins = (raw: string | undefined): string[] =>
  (raw ?? "")
    .split(",")
    .map((s) => s.trim().replace(/\/+$/, ""))
    .filter(Boolean);

const SECURITY_HEADERS: Record<string, string> = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
};

export function json(
  body: unknown,
  status = 200,
  cacheSeconds = 0,
  extra: Record<string, string> = {},
): Response {
  const headers: Record<string, string> = {
    "content-type": "application/json; charset=utf-8",
    ...SECURITY_HEADERS,
    "cache-control": cacheSeconds > 0 ? `public, max-age=${cacheSeconds}` : "no-store",
    ...extra,
  };
  return new Response(JSON.stringify(body), { status, headers });
}

export const errorJson = (status: number, error: string, extra: Record<string, string> = {}) =>
  json({ error }, status, 0, extra);

/** Adds CORS for an allow-listed origin only. Applied after the cache so the cached body never depends on the caller. */
export function withCors(res: Response, req: Request, env: ApiEnv): Response {
  const origin = req.headers.get("origin");
  const out = new Response(res.body, res);
  out.headers.append("vary", "Origin");
  if (origin && env.allowedOrigins.includes(origin)) {
    out.headers.set("access-control-allow-origin", origin);
    out.headers.set("access-control-allow-methods", "GET, POST, OPTIONS");
    out.headers.set("access-control-max-age", "86400");
  }
  return out;
}

/** The Workers edge cache, when present (absent in Node tests). Keys are built from validated parameters only. */
export interface EdgeCache {
  match(key: string): Promise<Response | undefined>;
  put(key: string, res: Response): Promise<void>;
}

export function defaultEdgeCache(): EdgeCache | null {
  const c = (globalThis as { caches?: { default?: Cache } }).caches?.default;
  if (!c) return null;
  const mk = (key: string) => new Request(`https://cache.truman.invalid${key}`);
  return {
    match: async (k) => c.match(mk(k)),
    put: async (k, res) => c.put(mk(k), res),
  };
}

/** In-memory fixed-window limiter, one per isolate. Best effort only: the real flood control is a Cloudflare rate-limit rule. */
export class RateLimiter {
  private hits = new Map<string, { windowStart: number; n: number }>();
  constructor(
    private limit: number,
    private windowMs: number,
    private maxKeys = 5000,
  ) {}

  /** Counts one hit. Returns seconds to wait when over the limit, else 0. */
  hit(key: string, now: number): number {
    const cur = this.hits.get(key);
    if (!cur || now - cur.windowStart >= this.windowMs) {
      if (this.hits.size >= this.maxKeys) this.sweep(now);
      if (this.hits.size >= this.maxKeys) this.hits.delete(this.hits.keys().next().value as string);
      this.hits.set(key, { windowStart: now, n: 1 });
      return 0;
    }
    cur.n++;
    return cur.n > this.limit ? Math.ceil((cur.windowStart + this.windowMs - now) / 1000) : 0;
  }

  /** Seconds to wait if already over the limit, without counting a hit. */
  blocked(key: string, now: number): number {
    const cur = this.hits.get(key);
    if (!cur || now - cur.windowStart >= this.windowMs) return 0;
    return cur.n > this.limit ? Math.ceil((cur.windowStart + this.windowMs - now) / 1000) : 0;
  }

  private sweep(now: number): void {
    for (const [k, v] of this.hits) if (now - v.windowStart >= this.windowMs) this.hits.delete(k);
  }
}

/** Constant-time string comparison (hash both sides first so length does not leak). */
export async function safeEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b)),
  ]);
  const x = new Uint8Array(ha);
  const y = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}
