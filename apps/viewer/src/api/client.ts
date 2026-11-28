import {
  LiveFeed,
  type ContextResponse,
  type Event,
  type ListResponse,
  type LogEntry,
  type ReplaySnapshot,
  type SearchResponse,
  type Snapshot,
} from "@truman/contracts";
import type { ApiLang } from "../i18n";
import {
  DEMO_CONTEXT,
  DEMO_EVENTS,
  DEMO_GOVERNOR,
  DEMO_LISTS,
  DEMO_LOG_ENTRIES,
  DEMO_SEARCHES,
  type SearchHistoryItem,
  DEMO_SNAPSHOT,
  DEMO_STATUS,
} from "./demoData";

/** Log entry as served by the Worker; `translated` is the cached PT text (null for en or not yet translated). */
export type TranslatedLogEntry = LogEntry & { translated?: string | null };

export interface StatusPayload {
  status: string;
  phase: string | null;
  day: number | null;
  last_tick_at: string | null;
  mode: string | null;
  world_day: number | null;
  season: string | null;
  next_decision_at?: string | null;
  next_tick_at?: string | null;
}

interface SnapshotFeed {
  snapshot: Snapshot;
  events: Event[];
  status: StatusPayload | null;
  replay_snapshots?: ReplaySnapshot[];
}

export type SnapshotFeedResult =
  | (SnapshotFeed & { state: "demo" | "live" | "stale" })
  | {
      state: "unavailable";
      snapshot: null;
      events: [];
      status: null;
      replay_snapshots?: undefined;
    };

const SNAPSHOT_STALE_AFTER_MS = 20 * 60_000;

export interface ViewerApiConfig {
  /** Worker public API base URL (e.g. https://truman-worker.workers.dev). Never Supabase. */
  apiBase?: string;
  /** Static snapshot host URL (decision 22: a single live.json per tick). */
  snapshotBase?: string;
  /** Optional custom fetch for unit tests. */
  fetchImpl?: typeof fetch;
}

export interface SearchParams {
  q: string;
  category?: "life" | "lab";
  kinds?: string[];
  lang?: ApiLang;
  sort?: "relevance" | "time";
  before_id?: number;
  limit?: number;
}

/** Newest first, whatever order the source returned (ids grow monotonically; ties keep source order). */
export function newestFirst<T>(items: readonly T[], idOf: (item: T) => number): T[] {
  return items
    .map((item, index) => ({ item, index, id: idOf(item) }))
    .sort(
      (a, b) =>
        (Number.isFinite(a.id) && Number.isFinite(b.id) ? b.id - a.id : 0) || a.index - b.index,
    )
    .map((entry) => entry.item);
}

function stripTrailingSlash(url: string | undefined): string {
  return (url ?? "").trim().replace(/\/+$/, "");
}

/**
 * Strictly read-only public viewer API client.
 * - Uses ONLY HTTP GET requests.
 * - Talks ONLY to the Worker API (`VITE_API_BASE`) and static snapshot host (`VITE_SNAPSHOT_BASE`).
 * - Never references Supabase or any secret tokens.
 * - Uses an offline demo when run without a static feed or reachable dev API.
 */
export class ViewerApiClient {
  readonly apiBase: string;
  readonly snapshotBase: string;
  private readonly fetchFn: typeof fetch;
  private latestStaticFeed: SnapshotFeed | null = null;
  public isDemoMode = false;

  constructor(cfg: ViewerApiConfig = {}) {
    this.apiBase = stripTrailingSlash(cfg.apiBase);
    this.snapshotBase = stripTrailingSlash(cfg.snapshotBase);
    this.fetchFn = cfg.fetchImpl ?? ((...args) => globalThis.fetch(...args));
    this.isDemoMode = !this.apiBase && !this.snapshotBase;
  }

  private async getJson<T>(
    url: string,
    options?: Pick<RequestInit, "cache" | "signal">,
  ): Promise<T | null> {
    try {
      const res = await this.fetchFn(url, {
        method: "GET",
        headers: { accept: "application/json" },
        ...options,
      });
      if (!res.ok) return null;
      return (await res.json()) as T;
    } catch {
      return null;
    }
  }

  /** In production, the snapshot and matching events arrive in one static response. */
  async fetchSnapshotFeed(): Promise<SnapshotFeedResult> {
    if (this.snapshotBase) return this.fetchStaticFeed();

    if (this.apiBase) {
      const [snap, evs, status] = await Promise.all([
        this.getJson<Snapshot>(`${this.apiBase}/api/snapshot`),
        this.getJson<Event[] | { events: Event[] }>(`${this.apiBase}/api/events?limit=200`),
        this.getStatus(),
      ]);
      if (snap) {
        const events = Array.isArray(evs) ? evs : (evs?.events ?? []);
        this.isDemoMode = false;
        return { snapshot: snap, events, status: status.demo ? null : status.data, state: "live" };
      }
    }

    this.isDemoMode = true;
    return { snapshot: DEMO_SNAPSHOT, events: DEMO_EVENTS, status: DEMO_STATUS, state: "demo" };
  }

  private async fetchStaticFeed(): Promise<SnapshotFeedResult> {
    const raw = await this.getJson<unknown>(`${this.snapshotBase}/live.json`, {
      cache: "no-cache",
      signal: AbortSignal.timeout(10_000),
    });
    const parsed = LiveFeed.safeParse(raw);
    const previous = this.latestStaticFeed;
    const next = parsed.success ? parsed.data : null;
    const usable =
      next &&
      (!previous ||
        (Date.parse(next.snapshot.generated_at) >= Date.parse(previous.snapshot.generated_at) &&
          next.snapshot.seq >= previous.snapshot.seq));
    if (usable) {
      this.latestStaticFeed = next;
    }

    const latest = this.latestStaticFeed;
    if (!latest) return { snapshot: null, events: [], status: null, state: "unavailable" };
    const age = Date.now() - Date.parse(latest.snapshot.generated_at);
    const status = latest.status?.status ?? latest.snapshot.status;
    const expectsUpdates =
      status !== "dead" &&
      status !== "paused" &&
      status !== "hibernating" &&
      latest.snapshot.resident.vitals.alive;
    const stale = expectsUpdates && (!usable || age > SNAPSHOT_STALE_AFTER_MS);
    return { ...latest, state: stale ? "stale" : "live" };
  }

  async getStatus(): Promise<{ data: StatusPayload; demo: boolean }> {
    if (this.apiBase) {
      const data = await this.getJson<StatusPayload>(`${this.apiBase}/api/status`);
      if (data) return { data, demo: false };
    }
    return { data: DEMO_STATUS, demo: true };
  }

  async getList(
    what:
      | "journal"
      | "dreams"
      | "beliefs"
      | "memories"
      | "ideas"
      | "organism"
      | "appraisals"
      | "decisions"
      | "traces"
      | "tools"
      | "errors",
    opts: { lab?: boolean; lang?: ApiLang; limit?: number; before?: number } = {},
  ): Promise<{ data: ListResponse; demo: boolean; error?: boolean }> {
    if (this.apiBase) {
      const qs = new URLSearchParams();
      if (opts.lang) qs.set("lang", opts.lang);
      if (opts.limit) qs.set("limit", String(opts.limit));
      if (opts.before) qs.set("before", String(opts.before));
      const prefix = opts.lab ? "/api/lab/" : "/api/";
      const url = `${this.apiBase}${prefix}${what}${qs.size ? `?${qs.toString()}` : ""}`;
      const data = await this.getJson<ListResponse>(url);
      if (data && Array.isArray(data.items)) {
        return {
          data: { ...data, items: newestFirst(data.items, (i) => Number(i["id"])) },
          demo: false,
        };
      }
      // A configured API that fails must not masquerade as demo content.
      return { data: { items: [], next_before: null }, demo: false, error: true };
    }
    return {
      data: {
        items: newestFirst(DEMO_LISTS[what] ?? [], (i) => Number(i["id"])),
        next_before: null,
      },
      demo: true,
    };
  }

  /** Public search history (what the Resident looked up on the web), newest first. */
  async getSearches(opts: { before?: number; limit?: number; lang?: ApiLang } = {}): Promise<{
    items: SearchHistoryItem[];
    next_before: number | null;
    demo: boolean;
    error?: boolean;
  }> {
    if (this.apiBase) {
      const qs = new URLSearchParams();
      if (opts.limit) qs.set("limit", String(opts.limit));
      if (opts.before !== undefined) qs.set("before", String(opts.before));
      if (opts.lang) qs.set("lang", opts.lang);
      const url = `${this.apiBase}/api/searches${qs.size ? `?${qs.toString()}` : ""}`;
      const data = await this.getJson<{ items: SearchHistoryItem[]; next_before?: number | null }>(
        url,
      );
      if (data && Array.isArray(data.items)) {
        return {
          items: newestFirst(data.items, (i) => i.id),
          next_before: data.next_before ?? null,
          demo: false,
        };
      }
      return { items: [], next_before: null, demo: false, error: true };
    }
    const filtered = DEMO_SEARCHES.filter((s) => opts.before === undefined || s.id < opts.before);
    return {
      items: newestFirst(filtered, (s) => s.id).slice(0, opts.limit ?? 30),
      next_before: null,
      demo: true,
    };
  }

  async getLog(
    opts: {
      kind?: string;
      category?: "life" | "lab";
      after?: number;
      before?: number;
      limit?: number;
      lang?: ApiLang;
    } = {},
  ): Promise<{
    items: TranslatedLogEntry[];
    next_after: number | null;
    demo: boolean;
    error?: boolean;
  }> {
    if (this.apiBase) {
      const qs = new URLSearchParams();
      if (opts.kind) qs.set("kind", opts.kind);
      if (opts.category) qs.set("category", opts.category);
      if (opts.after !== undefined) qs.set("after", String(opts.after));
      if (opts.before !== undefined) qs.set("before", String(opts.before));
      if (opts.limit) qs.set("limit", String(opts.limit));
      if (opts.lang) qs.set("lang", opts.lang);
      const url = `${this.apiBase}/api/log${qs.size ? `?${qs.toString()}` : ""}`;
      const data = await this.getJson<{ items: TranslatedLogEntry[]; next_after: number | null }>(
        url,
      );
      if (data && Array.isArray(data.items)) {
        return { ...data, items: newestFirst(data.items, (e) => e.id), demo: false };
      }
      return { items: [], next_after: null, demo: false, error: true };
    }
    const filtered = DEMO_LOG_ENTRIES.filter((entry) => {
      if (opts.kind && entry.kind !== opts.kind) return false;
      if (opts.category && entry.category !== opts.category) return false;
      if (opts.after !== undefined && entry.id <= opts.after) return false;
      if (opts.before !== undefined && entry.id >= opts.before) return false;
      return true;
    });
    return {
      items: newestFirst(filtered, (e) => e.id).slice(0, opts.limit ?? 50),
      next_after: null,
      demo: true,
    };
  }

  async search(params: SearchParams): Promise<{ data: SearchResponse; demo: boolean }> {
    const q = params.q.trim();
    if (!q) {
      return {
        data: { results: [], next_before_id: null, next_before_rank: null },
        demo: this.isDemoMode,
      };
    }

    if (this.apiBase) {
      const qs = new URLSearchParams({ q });
      if (params.category) qs.set("category", params.category);
      if (params.kinds && params.kinds.length > 0) qs.set("kinds", params.kinds.join(","));
      if (params.lang) qs.set("lang", params.lang);
      if (params.sort) qs.set("sort", params.sort);
      if (params.before_id) qs.set("before_id", String(params.before_id));
      if (params.limit) qs.set("limit", String(params.limit));
      const data = await this.getJson<SearchResponse>(
        `${this.apiBase}/api/search?${qs.toString()}`,
      );
      if (data && Array.isArray(data.results)) return { data, demo: false };
    }

    const needle = q.toLowerCase();
    const matched = DEMO_LOG_ENTRIES.filter((entry) => {
      if (params.category && entry.category !== params.category) return false;
      if (params.kinds && params.kinds.length > 0 && !params.kinds.includes(entry.kind)) {
        return false;
      }
      return (
        entry.text.toLowerCase().includes(needle) ||
        entry.kind.toLowerCase().includes(needle) ||
        JSON.stringify(entry.data).toLowerCase().includes(needle)
      );
    }).map((entry) => ({ ...entry, rank: 1 }));

    return {
      data: { results: matched, next_before_id: null, next_before_rank: null },
      demo: true,
    };
  }

  async getContext(entryId: number): Promise<{ data: ContextResponse | null; demo: boolean }> {
    if (this.apiBase) {
      const data = await this.getJson<ContextResponse>(`${this.apiBase}/api/context/${entryId}`);
      if (data && data.entry) return { data, demo: false };
    }
    if (this.snapshotBase) return { data: null, demo: false };
    const found = DEMO_LOG_ENTRIES.find((e) => e.id === entryId);
    if (found) {
      const causes = found.caused_by
        ? DEMO_LOG_ENTRIES.filter((e) => e.id === found.caused_by)
        : [];
      const consequences = DEMO_LOG_ENTRIES.filter((e) => e.caused_by === found.id).map((e) => ({
        ...e,
        depth: 1,
      }));
      return {
        data: {
          ...DEMO_CONTEXT,
          entry: found,
          causes,
          consequences,
        },
        demo: true,
      };
    }
    return { data: DEMO_CONTEXT, demo: true };
  }

  async getTrace(
    traceId: number,
  ): Promise<{ data: Record<string, unknown> | null; demo: boolean }> {
    if (this.apiBase) {
      const data = await this.getJson<Record<string, unknown>>(
        `${this.apiBase}/api/lab/traces/${traceId}`,
      );
      if (data) return { data, demo: false };
    }
    const hit = DEMO_LISTS["traces"]?.find((t) => Number(t["id"]) === traceId) ?? null;
    return { data: hit, demo: true };
  }

  async getGovernor(): Promise<{ data: Record<string, unknown>; demo: boolean }> {
    if (this.apiBase) {
      const data = await this.getJson<Record<string, unknown>>(`${this.apiBase}/api/lab/governor`);
      if (data) return { data, demo: false };
    }
    return { data: DEMO_GOVERNOR, demo: true };
  }

  async translateEntity(
    entity: "log_entries" | "journal" | "dreams" | "beliefs" | "memories",
    id: number,
  ): Promise<string | null> {
    if (!this.apiBase) return null;
    const qs = new URLSearchParams({ entity, id: String(id), lang: "pt" });
    const data = await this.getJson<{ text?: string }>(
      `${this.apiBase}/api/translate?${qs.toString()}`,
    );
    return typeof data?.text === "string" ? data.text : null;
  }
}

export function createViewerApiClient(): ViewerApiClient {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
  return new ViewerApiClient({
    apiBase: env["VITE_API_BASE"],
    snapshotBase: env["VITE_SNAPSHOT_BASE"],
  });
}
