// Typed environment. Secrets are read ONLY from here (Worker env bindings) and are never logged.
export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  ADMIN_TOKEN?: string;
  GEMINI_API_KEY?: string;
  GROQ_API_KEY?: string;
  TAVILY_API_KEY?: string;
  SUPABASE_FETCH_TIMEOUT_MS?: string;
}

export interface Config {
  supabaseUrl: string;
  supabaseServiceKey: string;
  /** Per-request timeout for Supabase calls, ms. */
  fetchTimeoutMs?: number;
}

/** Validates required bindings. Error messages name the variable, never its value. */
export function readConfig(env: Partial<Env>): Config {
  const missing: string[] = [];
  if (!env.SUPABASE_URL) missing.push("SUPABASE_URL");
  if (!env.SUPABASE_SERVICE_KEY) missing.push("SUPABASE_SERVICE_KEY");
  if (missing.length) throw new Error(`missing required env: ${missing.join(", ")}`);
  const url = env.SUPABASE_URL as string;
  let parsed: URL | null = null;
  try {
    parsed = new URL(url);
  } catch {
    /* handled below */
  }
  // exact host check: only the real localhost may use plain http (not localhost.evil.com, not user@host tricks)
  const ok =
    parsed !== null &&
    (parsed.protocol === "https:" ||
      (parsed.protocol === "http:" && parsed.hostname === "localhost"));
  if (!ok) throw new Error("SUPABASE_URL must be https");
  return {
    supabaseUrl: url.replace(/\/+$/, ""),
    supabaseServiceKey: env.SUPABASE_SERVICE_KEY as string,
    fetchTimeoutMs: clampTimeout(env.SUPABASE_FETCH_TIMEOUT_MS),
  };
}

export const MIN_FETCH_TIMEOUT_MS = 500;
export const MAX_FETCH_TIMEOUT_MS = 25000;
const DEFAULT_TIMEOUT_MS = 8000;

/** Junk, empty, zero, negative or non-finite fall back to the default; finite values are clamped to a sane range. */
export function clampTimeout(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === "") return DEFAULT_TIMEOUT_MS;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_TIMEOUT_MS;
  return Math.min(MAX_FETCH_TIMEOUT_MS, Math.max(MIN_FETCH_TIMEOUT_MS, n));
}

/** Case-insensitive percent-escapes (%2f == %2F) with every other character exact. */
function pctRegex(f: string): RegExp {
  const src = f
    .split(/(%[0-9A-Fa-f]{2})/)
    .map((part) =>
      /^%[0-9A-Fa-f]{2}$/.test(part)
        ? "%" + [...part.slice(1)].map((c) => `[${c.toLowerCase()}${c.toUpperCase()}]`).join("")
        : part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    )
    .join("");
  return new RegExp(src, "g");
}

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function b64Bytes(b: Uint8Array): string {
  let out = "";
  for (let i = 0; i < b.length; i += 3) {
    const n = ((b[i] ?? 0) << 16) | ((b[i + 1] ?? 0) << 8) | (b[i + 2] ?? 0);
    out += B64[(n >> 18) & 63]! + B64[(n >> 12) & 63]!;
    out += i + 1 < b.length ? B64[(n >> 6) & 63]! : "=";
    out += i + 2 < b.length ? B64[n & 63]! : "=";
  }
  return out;
}

/**
 * Base64 and base64url renderings of the value as it could appear inside a longer base64 string, i.e. at byte
 * offsets 0, 1 and 2 of the encoded payload (only the characters fully determined by the value are kept).
 */
function base64Forms(v: string): string[] {
  const bytes = new TextEncoder().encode(v);
  const forms: string[] = [];
  for (let k = 0; k < 3; k++) {
    const buf = new Uint8Array(k + bytes.length);
    buf.set(bytes, k);
    let e = b64Bytes(buf).replace(/=+$/, "");
    const lead = Math.ceil((k * 4) / 3); // chars touched by the k prefix bytes (the last is shared with the value)
    e = e.slice(k === 0 ? 0 : lead);
    const rem = (k + bytes.length) % 3; // trailing partial group: last char only partly determined by the value
    if (rem !== 0) e = e.slice(0, -1);
    forms.push(e, e.replace(/\+/g, "-").replace(/\//g, "_"));
  }
  const padded = b64Bytes(bytes);
  forms.push(padded, padded.replace(/\+/g, "-").replace(/\//g, "_"));
  return forms;
}

/** Removes one secret value (plain, JSON-escaped, percent-encoded in any hex case, base64/base64url at offsets 0-2). */
export function redactValue(text: string, v: string): string {
  if (v.length < 8) return text;
  let out = text;
  const exact = new Set([v, JSON.stringify(v).slice(1, -1)]);
  const pct = new Set([encodeURIComponent(v), encodeURI(v)]);
  const b64 = new Set(base64Forms(v));
  for (const f of exact) if (f.length >= 8) out = out.split(f).join("[redacted]");
  for (const f of pct) if (f.length >= 8) out = out.replace(pctRegex(f), "[redacted]");
  for (const f of b64) if (f.length >= 6) out = out.split(f).join("[redacted]");
  return out;
}

/** Removes known secret values from any string before it is logged or stored. */
export function redact(text: string, env: Partial<Env>): string {
  let out = text;
  for (const v of Object.values(env)) if (typeof v === "string") out = redactValue(out, v);
  return out;
}
