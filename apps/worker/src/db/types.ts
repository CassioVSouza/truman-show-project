// Db port: the only way the tick touches storage. One load phase, ONE batched commit RPC per tick.
export interface TickPayload {
  tick: {
    started_at: string;
    ended_at: string;
    mode: string;
    provider: string | null;
    ok: boolean;
    error: string | null;
  };
  log_entries?: Array<Record<string, unknown>>;
  events?: Array<Record<string, unknown>>;
  decisions?: Array<Record<string, unknown>>;
  memories?: Array<Record<string, unknown>>;
  organism_samples?: Array<Record<string, unknown>>;
  appraisals?: Array<Record<string, unknown>>;
  llm_traces?: Array<Record<string, unknown>>;
  tool_calls?: Array<Record<string, unknown>>;
  usage?: Array<Record<string, unknown>>;
  tool_usage?: Array<Record<string, unknown>>;
  resident?: Record<string, unknown>;
  kv?: Record<string, unknown>;
}

export interface CommitResult {
  tick_id: number;
  log_ids: Record<string, number>;
}

/** Loaded state. HIDDEN fields live here and must never be passed to buildPrompt. */
export interface LoadedState {
  resident: Record<string, unknown> | null;
  kv: Record<string, unknown>;
}

export interface Db {
  loadState(): Promise<LoadedState>;
  commitTick(payload: TickPayload): Promise<CommitResult>;
}
