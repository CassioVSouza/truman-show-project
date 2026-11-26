// Governor modes and daily budgets (doc 05). Pure functions over the kv snapshot; counters are written back in
// the tick's single commit. The 10-minute pace is kept whenever the budget allows: slowing only under pressure.
import type { Env } from "../env";

export type Mode = "normal" | "thrifty" | "reading_only" | "idle" | "hibernating";

export interface GovernorConfig {
  maxLlmCallsDay: number;
  maxSearchDay: number;
  maxFetchDay: number;
  maxEarlyTicksDay: number;
  tickMinutes: number;
  /** Fraction of any budget at which thrifty starts. */
  thriftyAt: number;
  /** Consecutive failed ticks before hibernating (state preserved, resumable). */
  hardFailStreak: number;
  leaseTtlMs: number;
}

export const DEFAULT_GOVERNOR: GovernorConfig = {
  maxLlmCallsDay: 200,
  maxSearchDay: 30,
  maxFetchDay: 100,
  maxEarlyTicksDay: 12,
  tickMinutes: 10,
  thriftyAt: 0.7,
  hardFailStreak: 6,
  leaseTtlMs: 120_000,
};

const num = (v: string | undefined, d: number): number => {
  const n = v === undefined ? NaN : Number(v);
  return Number.isFinite(n) && n > 0 ? n : d;
};

export function governorConfigFromEnv(
  env: Partial<
    Pick<
      Env,
      | "MAX_LLM_CALLS_DAY"
      | "MAX_SEARCH_DAY"
      | "MAX_FETCH_DAY"
      | "MAX_EARLY_TICKS_DAY"
      | "TICK_MINUTES"
    >
  >,
): GovernorConfig {
  const d = DEFAULT_GOVERNOR;
  return {
    ...d,
    maxLlmCallsDay: num(env.MAX_LLM_CALLS_DAY, d.maxLlmCallsDay),
    maxSearchDay: num(env.MAX_SEARCH_DAY, d.maxSearchDay),
    maxFetchDay: num(env.MAX_FETCH_DAY, d.maxFetchDay),
    maxEarlyTicksDay: num(env.MAX_EARLY_TICKS_DAY, d.maxEarlyTicksDay),
    tickMinutes: num(env.TICK_MINUTES, d.tickMinutes),
  };
}

/** Persisted in kv under `budget`. Resets at the UTC day boundary. */
export interface Budget {
  day: string;
  llm_calls: number;
  search_calls: number;
  fetch_calls: number;
  early_ticks: number;
  fail_streak: number;
  /** Providers out of quota today (QuotaExhausted). */
  exhausted: string[];
}

export const utcDay = (now: Date): string => now.toISOString().slice(0, 10);

export function readBudget(kv: Record<string, unknown>, now: Date): Budget {
  const raw = kv["budget"];
  const fresh: Budget = {
    day: utcDay(now),
    llm_calls: 0,
    search_calls: 0,
    fetch_calls: 0,
    early_ticks: 0,
    fail_streak: 0,
    exhausted: [],
  };
  if (!raw || typeof raw !== "object") return fresh;
  const b = raw as Partial<Budget>;
  const streak = Number(b.fail_streak) || 0;
  if (b.day !== fresh.day) return { ...fresh, fail_streak: streak }; // new day: counters and exhaustion reset
  return {
    day: fresh.day,
    llm_calls: Number(b.llm_calls) || 0,
    search_calls: Number(b.search_calls) || 0,
    fetch_calls: Number(b.fetch_calls) || 0,
    early_ticks: Number(b.early_ticks) || 0,
    fail_streak: streak,
    exhausted: Array.isArray(b.exhausted) ? b.exhausted.filter((x) => typeof x === "string") : [],
  };
}

export interface ModePlan {
  mode: Mode;
  budget: Budget;
  /** Highest fraction used across the budgets. */
  pressure: number;
  allowSearch: boolean;
  allowFetch: boolean;
  /** Interpreter LLM call allowed (thrifty uses rule tables instead). */
  allowInterpreter: boolean;
  /** Resident decision call allowed (false in idle and hibernating). */
  allowDecide: boolean;
  /** Minimum minutes between Resident decisions (doubled under thrifty). */
  decisionIntervalMin: number;
  /** LLM calls this tick may still make. */
  llmCallsLeft: number;
}

export function pickMode(
  kv: Record<string, unknown>,
  now: Date,
  cfg: GovernorConfig = DEFAULT_GOVERNOR,
): ModePlan {
  const budget = readBudget(kv, now);
  const llmFrac = budget.llm_calls / cfg.maxLlmCallsDay;
  const searchFrac = budget.search_calls / cfg.maxSearchDay;
  const fetchFrac = budget.fetch_calls / cfg.maxFetchDay;
  const pressure = Math.max(llmFrac, searchFrac, fetchFrac);
  const searchOut = searchFrac >= 1;
  const fetchOut = fetchFrac >= 1;
  const llmOut = llmFrac >= 1;
  const base = {
    budget,
    pressure,
    allowSearch: !searchOut,
    allowFetch: !fetchOut,
    allowInterpreter: true,
    allowDecide: true,
    decisionIntervalMin: cfg.tickMinutes,
    llmCallsLeft: Math.max(0, cfg.maxLlmCallsDay - budget.llm_calls),
  };
  if (budget.fail_streak >= cfg.hardFailStreak)
    return {
      ...base,
      mode: "hibernating",
      allowDecide: false,
      allowInterpreter: false,
      allowSearch: false,
      allowFetch: false,
    };
  if (llmOut)
    return {
      ...base,
      mode: "idle",
      allowDecide: false,
      allowInterpreter: false,
      allowSearch: false,
      allowFetch: false,
    };
  const thrifty =
    llmFrac >= cfg.thriftyAt ||
    (!searchOut && searchFrac >= cfg.thriftyAt) ||
    (!fetchOut && fetchFrac >= cfg.thriftyAt);
  if (thrifty)
    return {
      ...base,
      mode: "thrifty",
      allowInterpreter: false,
      decisionIntervalMin: cfg.tickMinutes * 2,
    };
  if (searchOut) return { ...base, mode: "reading_only" };
  return { ...base, mode: "normal" };
}

export interface UsageDelta {
  llm_calls?: number;
  search_calls?: number;
  fetch_calls?: number;
  early_tick?: boolean;
  /** true when the tick succeeded; false when it failed (extends the hard-failure streak). */
  ok: boolean;
  exhausted?: Iterable<string>;
}

export function applyUsage(b: Budget, d: UsageDelta): Budget {
  return {
    ...b,
    llm_calls: b.llm_calls + (d.llm_calls ?? 0),
    search_calls: b.search_calls + (d.search_calls ?? 0),
    fetch_calls: b.fetch_calls + (d.fetch_calls ?? 0),
    early_ticks: b.early_ticks + (d.early_tick ? 1 : 0),
    fail_streak: d.ok ? 0 : b.fail_streak + 1,
    exhausted: [...new Set([...b.exhausted, ...(d.exhausted ?? [])])],
  };
}

/** An emergency early-wake tick is allowed only while under the daily cap (doc 05); past it, reflexes carry on. */
export const canEarlyTick = (b: Budget, cfg: GovernorConfig = DEFAULT_GOVERNOR): boolean =>
  b.early_ticks < cfg.maxEarlyTicksDay;

// ---------------- lease: overlapping runs do nothing ----------------
export interface LeaseRow {
  holder: string;
  expires_at: string;
}

/** Pure check on the kv `lease` row. Atomic acquire needs a conditional write in the Db layer (Lease port). */
export function leaseFree(row: unknown, now: Date): boolean {
  if (!row || typeof row !== "object") return true;
  const r = row as Partial<LeaseRow>;
  const exp = r.expires_at ? Date.parse(r.expires_at) : NaN;
  return !Number.isFinite(exp) || exp <= now.getTime();
}

/** Port implemented by the Db layer with a compare-and-set on kv; InMemoryLease serves tests. */
export interface Lease {
  acquire(holder: string, now: Date, ttlMs: number): Promise<boolean>;
  release(holder: string): Promise<void>;
}

export class InMemoryLease implements Lease {
  row: LeaseRow | null = null;
  async acquire(holder: string, now: Date, ttlMs: number): Promise<boolean> {
    if (!leaseFree(this.row, now)) return false;
    this.row = { holder, expires_at: new Date(now.getTime() + ttlMs).toISOString() };
    return true;
  }
  async release(holder: string): Promise<void> {
    if (this.row?.holder === holder) this.row = null;
  }
}
