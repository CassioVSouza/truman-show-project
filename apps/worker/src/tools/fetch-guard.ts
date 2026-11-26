// Infrastructure-only fetch guard (docs 02, 12). Protects Worker/infra from SSRF, giant responses, and hangs.
// Never filters Resident content, topics, or public domains (hard rule 4).
import type { FetchLike } from "../llm";

export const DEFAULT_MAX_BYTES = 2 * 1024 * 1024; // 2 MB (doc 02)
export const DEFAULT_TIMEOUT_MS = 8_000; // 8 s (doc 02)
export const DEFAULT_MAX_REDIRECTS = 5;

export type FetchGuardErrorCode =
  | "invalid_url"
  | "scheme"
  | "port"
  | "credentials"
  | "blocked_host"
  | "redirect_limit"
  | "bad_redirect"
  | "content_type"
  | "too_large"
  | "timeout"
  | "network";

export class FetchGuardError extends Error {
  constructor(
    public readonly code: FetchGuardErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "FetchGuardError";
  }
}

export function isBlockedIpv4(a: number, b: number, c: number, d: number): boolean {
  if ([a, b, c, d].some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // 10.0.0.0/8 RFC 1918
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local & cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 RFC 1918
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return true; // 192.0.0.0/24, TEST-NET-1
  if (a === 192 && b === 168) return true; // 192.168.0.0/16 RFC 1918
  if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15 benchmarking
  if (a === 198 && b === 51 && c === 100) return true; // TEST-NET-2
  if (a === 203 && b === 0 && c === 113) return true; // TEST-NET-3
  if (a >= 224) return true; // 224.0.0.0/4 multicast + 240.0.0.0/4 reserved/broadcast
  return false;
}

/** Parses an IPv6 address (without brackets) into 8 16-bit groups, or null if malformed. */
export function parseIpv6(raw: string): number[] | null {
  if (!raw || raw.includes("%")) return null;
  let s = raw.toLowerCase();
  // Convert trailing embedded IPv4 (e.g. ::ffff:127.0.0.1) into two hex groups.
  const lastColon = s.lastIndexOf(":");
  if (lastColon >= 0 && s.slice(lastColon + 1).includes(".")) {
    const v4 = s.slice(lastColon + 1).split(".");
    if (v4.length !== 4 || !v4.every((p) => /^\d+$/.test(p))) return null;
    const oct = v4.map(Number);
    if (oct.some((n) => n < 0 || n > 255)) return null;
    const hi = ((oct[0]! << 8) | oct[1]!).toString(16);
    const lo = ((oct[2]! << 8) | oct[3]!).toString(16);
    s = `${s.slice(0, lastColon + 1)}${hi}:${lo}`;
  }
  const halves = s.split("::");
  if (halves.length > 2) return null;
  const parsePart = (p: string): number[] | null => {
    if (p === "") return [];
    const items = p.split(":");
    const nums: number[] = [];
    for (const it of items) {
      if (!/^[0-9a-f]{1,4}$/.test(it)) return null;
      nums.push(parseInt(it, 16));
    }
    return nums;
  };
  const left = parsePart(halves[0]!);
  const right = halves.length === 2 ? parsePart(halves[1]!) : [];
  if (!left || !right) return null;
  if (halves.length === 1) return left.length === 8 ? left : null;
  const missing = 8 - left.length - right.length;
  if (missing < 1) return null;
  return [...left, ...new Array<number>(missing).fill(0), ...right];
}

export function isBlockedIpv6(raw: string): boolean {
  const g = parseIpv6(raw);
  if (!g) return true; // malformed IPv6 fails closed
  const allZero = g.every((x) => x === 0);
  if (allZero) return true; // ::/128 unspecified
  const loopback = g.slice(0, 7).every((x) => x === 0) && g[7] === 1;
  if (loopback) return true; // ::1/128
  const g0 = g[0]!;
  if ((g0 & 0xfe00) === 0xfc00) return true; // fc00::/7 ULA
  if ((g0 & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((g0 & 0xffc0) === 0xfec0) return true; // fec0::/10 deprecated site-local
  if ((g0 & 0xff00) === 0xff00) return true; // ff00::/8 multicast
  if (g0 === 0x0100 && g[1] === 0 && g[2] === 0 && g[3] === 0) return true; // 100::/64 discard
  if (g0 === 0x2001 && g[1] === 0x0db8) return true; // 2001:db8::/32 documentation
  // IPv4-mapped ::ffff:0:0/96 or IPv4-compatible ::/96
  const zeroFirst5 = g[0] === 0 && g[1] === 0 && g[2] === 0 && g[3] === 0 && g[4] === 0;
  if (zeroFirst5 && (g[5] === 0xffff || g[5] === 0)) {
    return isBlockedIpv4(g[6]! >> 8, g[6]! & 0xff, g[7]! >> 8, g[7]! & 0xff);
  }
  // NAT64 64:ff9b::/96 and 64:ff9b:1::/48
  if (g[0] === 0x0064 && g[1] === 0xff9b) {
    if (g[2] === 1) return true; // local-use NAT64
    if (g[2] === 0 && g[3] === 0 && g[4] === 0 && g[5] === 0) {
      return isBlockedIpv4(g[6]! >> 8, g[6]! & 0xff, g[7]! >> 8, g[7]! & 0xff);
    }
  }
  // 6to4 2002::/16 embeds IPv4 in g[1], g[2]
  if (g[0] === 0x2002) {
    return isBlockedIpv4(g[1]! >> 8, g[1]! & 0xff, g[2]! >> 8, g[2]! & 0xff);
  }
  return false;
}

export function isBlockedHostname(rawHost: string): boolean {
  const host = rawHost.trim().toLowerCase().replace(/\.+$/, "");
  if (!host) return true;
  if (host.startsWith("[") && host.endsWith("]")) {
    return isBlockedIpv6(host.slice(1, -1));
  }
  if (host.includes(":")) {
    return isBlockedIpv6(host);
  }
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".arpa") ||
    host === "metadata" ||
    host === "metadata.google.internal"
  ) {
    return true;
  }
  const v4 = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (v4) {
    return isBlockedIpv4(Number(v4[1]), Number(v4[2]), Number(v4[3]), Number(v4[4]));
  }
  // Block non-standard numeric/hex/octal IPv4 literals (e.g. 2130706433, 0x7f000001, 127.1)
  const parts = host.split(".");
  if (parts.every((p) => /^(?:\d+|0x[0-9a-f]+)$/.test(p))) return true;
  return false;
}

export function validateFetchUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new FetchGuardError("invalid_url", "invalid URL");
  }
  if (url.protocol !== "https:") {
    throw new FetchGuardError("scheme", `only https is allowed (got ${url.protocol})`);
  }
  if (url.username || url.password) {
    throw new FetchGuardError("credentials", "URL credentials are not allowed");
  }
  if (url.port && url.port !== "443") {
    throw new FetchGuardError("port", `port ${url.port} is not allowed`);
  }
  if (isBlockedHostname(url.hostname)) {
    throw new FetchGuardError("blocked_host", "host is private, loopback, or reserved");
  }
  return url;
}

const ALLOWED_EXACT_TYPES = new Set([
  "application/json",
  "application/xml",
  "application/xhtml+xml",
  "application/rss+xml",
  "application/atom+xml",
]);

export function isAllowedContentType(header: string | null): boolean {
  if (!header) return false;
  const media = header.split(";")[0]!.trim().toLowerCase();
  if (media.startsWith("text/")) return true;
  if (ALLOWED_EXACT_TYPES.has(media)) return true;
  if (media.startsWith("application/") && (media.endsWith("+json") || media.endsWith("+xml"))) {
    return true;
  }
  return false;
}

export interface GuardedFetchOptions {
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
  maxBytes?: number;
  timeoutMs?: number;
  maxRedirects?: number;
  fetchFn?: FetchLike;
}

export interface GuardedResponse {
  url: string;
  status: number;
  contentType: string;
  text: string;
  bytes: number;
}

const REDIRECT_STATUS = new Set([301, 302, 303, 307, 308]);
const SENSITIVE_REDIRECT_HEADERS = new Set(["authorization", "cookie", "proxy-authorization"]);

function stripSensitiveHeaders(
  headers?: Record<string, string>,
): Record<string, string> | undefined {
  if (!headers) return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    if (!SENSITIVE_REDIRECT_HEADERS.has(k.toLowerCase())) out[k] = v;
  }
  return out;
}

export async function guardedFetch(
  rawUrl: string,
  opts: GuardedFetchOptions = {},
): Promise<GuardedResponse> {
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRedirects = opts.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const fetchFn: FetchLike = opts.fetchFn ?? ((u, i) => fetch(u, i));

  let currentUrl = validateFetchUrl(rawUrl).toString();
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    let res: Response | null = null;
    for (let hop = 0; hop <= maxRedirects; hop++) {
      let hopRes: Response;
      try {
        hopRes = await fetchFn(currentUrl, {
          method: hop === 0 ? (opts.method ?? "GET") : "GET",
          headers: hop === 0 ? opts.headers : stripSensitiveHeaders(opts.headers),
          body: hop === 0 ? opts.body : undefined,
          redirect: "manual",
          signal: controller.signal,
        });
      } catch (e) {
        if (timedOut || controller.signal.aborted) {
          throw new FetchGuardError("timeout", `fetch timed out after ${timeoutMs} ms`);
        }
        const msg = e instanceof Error ? e.message : String(e);
        throw new FetchGuardError("network", `fetch failed: ${msg.slice(0, 160)}`);
      }
      res = hopRes;
      if (REDIRECT_STATUS.has(hopRes.status)) {
        await hopRes.body?.cancel().catch(() => undefined);
        if (hop === maxRedirects) {
          throw new FetchGuardError("redirect_limit", `too many redirects (max ${maxRedirects})`);
        }
        const loc = hopRes.headers.get("location");
        if (!loc) {
          throw new FetchGuardError("bad_redirect", "redirect missing Location header");
        }
        let nextUrl: string;
        try {
          nextUrl = new URL(loc, currentUrl).toString();
        } catch {
          throw new FetchGuardError("bad_redirect", "malformed redirect Location");
        }
        currentUrl = validateFetchUrl(nextUrl).toString();
        continue;
      }
      break;
    }

    if (!res) throw new FetchGuardError("network", "no response received");
    const ct = res.headers.get("content-type") ?? "";
    if (res.ok && !isAllowedContentType(ct)) {
      throw new FetchGuardError("content_type", `disallowed content-type: ${ct.slice(0, 80)}`);
    }

    const clHeader = res.headers.get("content-length");
    if (clHeader !== null) {
      const cl = Number(clHeader);
      if (Number.isFinite(cl) && cl > maxBytes) {
        throw new FetchGuardError("too_large", `response exceeds ${maxBytes} bytes`);
      }
    }

    const { text, bytes } = await readBoundedText(
      res,
      maxBytes,
      () => timedOut || controller.signal.aborted,
      timeoutMs,
    );
    return { url: currentUrl, status: res.status, contentType: ct, text, bytes };
  } finally {
    clearTimeout(timer);
  }
}

async function readBoundedText(
  res: Response,
  maxBytes: number,
  isTimedOut: () => boolean,
  timeoutMs: number,
): Promise<{ text: string; bytes: number }> {
  if (!res.body) {
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength > maxBytes) {
      throw new FetchGuardError("too_large", `response exceeds ${maxBytes} bytes`);
    }
    return { text: new TextDecoder().decode(buf), bytes: buf.byteLength };
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      let step: ReadableStreamReadResult<Uint8Array>;
      try {
        step = await reader.read();
      } catch (e) {
        if (isTimedOut())
          throw new FetchGuardError("timeout", `fetch timed out after ${timeoutMs} ms`);
        throw new FetchGuardError("network", `read failed: ${String(e).slice(0, 120)}`);
      }
      if (step.done) break;
      const chunk = step.value;
      total += chunk.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new FetchGuardError("too_large", `response exceeds ${maxBytes} bytes`);
      }
      chunks.push(chunk);
    }
  } finally {
    reader.releaseLock();
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.byteLength;
  }
  return { text: new TextDecoder().decode(merged), bytes: total };
}
