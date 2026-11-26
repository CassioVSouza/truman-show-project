// Real web tools (docs 02, 05, 12): Tavily search (with Wikipedia fallback) and guarded page reader.
// No content filtering, no blocklists, no safe-search (hard rule 4). Secrets are never logged or returned (hard rule 8).
import type { FetchLike } from "../llm";
import { guardedFetch, FetchGuardError } from "./fetch-guard";
import type { ToolOutcome, Tools } from "./index";

const MAX_OUTPUT_CHARS = 8_000;
const NOTHING = "The terminal gives no answer.";

export interface WebToolsOptions {
  tavilyApiKey?: string;
  fetchFn?: FetchLike;
  /** Scrubs secrets from any error text before it is returned or logged. */
  scrub?: (s: string) => string;
  timeoutMs?: number;
  maxBytes?: number;
}

interface TavilyResult {
  title?: string;
  url?: string;
  content?: string;
}

interface TavilyResponse {
  results?: TavilyResult[];
}

interface WikiSearchResponse {
  query?: {
    search?: Array<{ title?: string; snippet?: string; pageid?: number }>;
  };
}

/** Lightweight HTML-to-plain-text extraction (keeps meaning, strips markup/scripts/styles, never filters content). */
export function htmlToText(html: string): string {
  const withoutBlocks = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
  const withBreaks = withoutBlocks.replace(
    /<\/?(?:p|div|br|li|h[1-6]|tr|section|article)\b[^>]*>/gi,
    "\n",
  );
  const stripped = withBreaks.replace(/<[^>]+>/g, " ");
  const decoded = stripped
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
  return decoded
    .replace(/[ \t\r\f\v]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

export function createWebTools(opts: WebToolsOptions = {}): Tools {
  const scrub = opts.scrub ?? ((s: string) => s);
  const fetchFn = opts.fetchFn;
  const timeoutMs = opts.timeoutMs;
  const maxBytes = opts.maxBytes;

  async function searchTavily(query: string): Promise<ToolOutcome> {
    const key = opts.tavilyApiKey;
    if (!key) return { ok: false, text: NOTHING, bytes: 0, status: 0, error: "no_tavily_key" };
    try {
      const res = await guardedFetch("https://api.tavily.com/search", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          query,
          max_results: 5,
          include_answer: false,
          search_depth: "basic",
        }),
        fetchFn,
        timeoutMs,
        maxBytes,
      });
      if (res.status < 200 || res.status >= 300) {
        return {
          ok: false,
          text: NOTHING,
          bytes: res.bytes,
          status: res.status,
          error: scrub(`tavily http ${res.status}`),
        };
      }
      const data = JSON.parse(res.text) as TavilyResponse;
      const items = (data.results ?? []).slice(0, 5);
      if (items.length === 0) {
        return {
          ok: true,
          text: "No results found.",
          bytes: res.bytes,
          status: res.status,
        };
      }
      const lines = items.map((r) => {
        const title = (r.title ?? "").trim();
        const url = (r.url ?? "").trim();
        const snippet = (r.content ?? "").replace(/\s+/g, " ").trim().slice(0, 600);
        return `${title}${url ? ` (${url})` : ""}\n${snippet}`;
      });
      return {
        ok: true,
        text: scrub(lines.join("\n\n")).slice(0, MAX_OUTPUT_CHARS),
        source_url: items[0]?.url,
        bytes: res.bytes,
        status: res.status,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return {
        ok: false,
        text: NOTHING,
        bytes: 0,
        status: 0,
        error: scrub(msg).slice(0, 200),
      };
    }
  }

  async function searchWikipedia(query: string): Promise<ToolOutcome> {
    const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=5`;
    try {
      const res = await guardedFetch(url, {
        method: "GET",
        headers: { accept: "application/json", "user-agent": "TrumanShowProject/1.0" },
        fetchFn,
        timeoutMs,
        maxBytes,
      });
      if (res.status < 200 || res.status >= 300) {
        return {
          ok: false,
          text: NOTHING,
          bytes: res.bytes,
          status: res.status,
          error: scrub(`wikipedia http ${res.status}`),
        };
      }
      const data = JSON.parse(res.text) as WikiSearchResponse;
      const items = (data.query?.search ?? []).slice(0, 5);
      if (items.length === 0) {
        return { ok: true, text: "No results found.", bytes: res.bytes, status: res.status };
      }
      const lines = items.map((r) => {
        const title = (r.title ?? "").trim();
        const pageUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
        const snippet = htmlToText(r.snippet ?? "").slice(0, 500);
        return `${title} (${pageUrl})\n${snippet}`;
      });
      return {
        ok: true,
        text: scrub(lines.join("\n\n")).slice(0, MAX_OUTPUT_CHARS),
        source_url: `https://en.wikipedia.org/wiki/${encodeURIComponent((items[0]?.title ?? "").replace(/ /g, "_"))}`,
        bytes: res.bytes,
        status: res.status,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return {
        ok: false,
        text: NOTHING,
        bytes: 0,
        status: 0,
        error: scrub(msg).slice(0, 200),
      };
    }
  }

  return {
    async webSearch(query: string): Promise<ToolOutcome> {
      const q = query.trim();
      if (!q) return { ok: false, text: NOTHING, bytes: 0, status: 0, error: "empty_query" };
      if (opts.tavilyApiKey) {
        const r = await searchTavily(q);
        if (r.ok) return r;
        // Fall back to Wikipedia if Tavily fails
        const w = await searchWikipedia(q);
        return w.ok ? w : r;
      }
      return searchWikipedia(q);
    },

    async readPage(url: string): Promise<ToolOutcome> {
      try {
        const res = await guardedFetch(url, {
          method: "GET",
          headers: {
            accept: "text/plain, text/markdown, text/html, application/json;q=0.9",
            "user-agent": "TrumanShowProject/1.0",
          },
          fetchFn,
          timeoutMs,
          maxBytes,
        });
        if (res.status < 200 || res.status >= 300) {
          return {
            ok: false,
            text: NOTHING,
            source_url: res.url,
            bytes: res.bytes,
            status: res.status,
            error: scrub(`http ${res.status}`),
          };
        }
        const media = res.contentType.split(";")[0]!.trim().toLowerCase();
        const plain =
          media === "text/html" || media === "application/xhtml+xml"
            ? htmlToText(res.text)
            : res.text.trim();
        return {
          ok: true,
          text: scrub(plain || "(empty page)").slice(0, MAX_OUTPUT_CHARS),
          source_url: res.url,
          bytes: res.bytes,
          status: res.status,
        };
      } catch (e) {
        const msg =
          e instanceof FetchGuardError
            ? `${e.code}: ${e.message}`
            : e instanceof Error
              ? e.message
              : String(e);
        return {
          ok: false,
          text: NOTHING,
          source_url: url,
          bytes: 0,
          status: 0,
          error: scrub(msg).slice(0, 200),
        };
      }
    },
  };
}
