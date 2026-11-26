// Narrow ports the tick depends on. Log entries go through the single writer in apps/worker/src/log
// (data-api-engineer); every other typed row (events, decisions, traces, usage...) goes through TickRows.
import type { LlmTraceRow } from "../llm";
import type { TickPayload } from "../db/types";
import type { Log } from "../log";

/** The log writer as the tick uses it: add entries, then attach them to the one commit payload. */
export type TickLog = Log & { attach(payload: TickPayload): TickPayload };

export interface EventInput {
  v: 1;
  t_start: string;
  t_end: string;
  kind: string;
  actor: "resident" | "world";
  data: Record<string, unknown>;
  /** A LogRef from the writer. */
  log_ref?: string;
}

/** Typed rows of one tick. Maps one-to-one onto the `tick_commit` RPC payload keys. */
export interface TickRows {
  event(e: EventInput): void;
  decision(row: Record<string, unknown>): void;
  memory(row: Record<string, unknown>): void;
  /** `stimulus_ref` is a LogRef from the writer. */
  appraisal(row: Record<string, unknown>): void;
  organismSample(row: Record<string, unknown>): void;
  llmTrace(row: LlmTraceRow): void;
  toolCall(row: Record<string, unknown>): void;
  usage(row: Record<string, unknown>): void;
  toolUsage(row: Record<string, unknown>): void;
  /** Hands the accumulated rows to the commit (called once per tick). */
  drain(): Omit<TickPayload, "tick" | "kv" | "resident" | "log_entries">;
}
