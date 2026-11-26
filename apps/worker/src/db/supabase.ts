import { redactValue, type Config } from "../env";
import type { CommitResult, Db, LoadedState, TickPayload } from "./types";

export const MAX_SUBREQUESTS = 50;
export const DEFAULT_FETCH_TIMEOUT_MS = 8000;
type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** PostgREST over HTTPS with the service key. Counts subrequests so a tick can never exceed the free-tier cap. */
export class SupabaseDb implements Db {
  private count = 0;
  constructor(
    private cfg: Config,
    private fetchFn: FetchLike = (u, i) => fetch(u, i),
    private cap = MAX_SUBREQUESTS - 5,
  ) {}

  private get timeoutMs(): number {
    return this.cfg.fetchTimeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS;
  }

  get subrequests(): number {
    return this.count;
  }

  /**
   * Normal calls may use at most cap-1 subrequests; the last one is reserved for the failed-tick row, so a
   * subrequest-budget error can still be logged.
   */
  private async call(path: string, init: RequestInit, reserved = false): Promise<unknown> {
    const limit = reserved ? this.cap : this.cap - 1;
    if (this.count >= limit) throw new Error(`subrequest budget exhausted (${limit})`);
    this.count++;
    const key = this.cfg.supabaseServiceKey;
    let res: Response;
    try {
      res = await this.fetchFn(`${this.cfg.supabaseUrl}${path}`, {
        ...init,
        signal: AbortSignal.timeout(this.timeoutMs),
        headers: {
          apikey: this.cfg.supabaseServiceKey,
          authorization: `Bearer ${this.cfg.supabaseServiceKey}`,
          "content-type": "application/json",
        },
      });
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      // cause intentionally not attached: the original error may contain the key
      // eslint-disable-next-line preserve-caught-error
      throw new Error(`supabase ${path.split("?")[0]} request failed: ${redactValue(m, key)}`);
    }
    if (!res.ok) {
      // redact first, then keep only a short snippet (so a key cut by the slice cannot survive)
      const snippet = redactValue(await res.text().catch(() => ""), key).slice(0, 200);
      throw new Error(`supabase ${path.split("?")[0]} failed: ${res.status} ${snippet}`);
    }
    const body = await res.text();
    return body ? JSON.parse(body) : null; // void RPCs answer 204 with an empty body
  }

  async loadState(): Promise<LoadedState> {
    const [res, kv] = await Promise.all([
      this.call("/rest/v1/resident?id=eq.1&select=*", { method: "GET" }),
      this.call("/rest/v1/kv?select=key,value", { method: "GET" }),
    ]);
    const rows = res as Array<Record<string, unknown>>;
    const kvMap: Record<string, unknown> = {};
    for (const r of kv as Array<{ key: string; value: unknown }>) kvMap[r.key] = r.value;
    return { resident: rows[0] ?? null, kv: kvMap };
  }

  /**
   * Generic PostgREST RPC for the read API and admin routes (one subrequest per call). Only the Worker may call this;
   * the SQL functions are granted to service_role alone. `name` is restricted to a safe identifier.
   */
  async rpc(name: string, args: Record<string, unknown> = {}): Promise<unknown> {
    if (!/^[a-z][a-z0-9_]{0,63}$/.test(name)) throw new Error("invalid rpc name");
    return this.call(`/rest/v1/rpc/${name}`, { method: "POST", body: JSON.stringify(args) });
  }

  async commitTick(payload: TickPayload): Promise<CommitResult> {
    return (await this.call(
      "/rest/v1/rpc/tick_commit",
      { method: "POST", body: JSON.stringify({ payload }) },
      payload.tick.mode === "failed",
    )) as CommitResult;
  }
}
