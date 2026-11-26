import type { Db, TickPayload } from "../db/types";
import { gate } from "../governor";

export interface TickResult {
  ran: boolean;
  reason: string;
  tick_id: number | null;
}

/** Append-only log row for a tick with no other content (Phase 0 done test: an empty tick writes a log entry). */
function tickLog(mode: string, text: string): Record<string, unknown> {
  return { kind: "tick", category: "lab", text, data: { mode } };
}

/** Empty tick: load, gate, (no LLM yet), exactly one commit RPC. */
export async function runTick(
  db: Db,
  now: () => Date = () => new Date(),
  scrub: (s: string) => string = (s) => s,
): Promise<TickResult> {
  const started = now();
  try {
    return await runTickInner(db, now, started);
  } catch (e) {
    // Best effort, never loop: one minimal failed-tick row via a single tick_commit, then rethrow the original error.
    const msg = e instanceof Error ? e.message : String(e);
    try {
      await db.commitTick({
        tick: {
          started_at: started.toISOString(),
          ended_at: now().toISOString(),
          mode: "failed",
          provider: null,
          ok: false,
          error: scrub(msg).slice(0, 500),
        },
        log_entries: [tickLog("failed", `tick failed: ${scrub(msg).slice(0, 200)}`)],
      });
    } catch {
      /* the failure row itself failed (e.g. DB down or subrequest cap): give up, the caller logs the original */
    }
    throw e;
  }
}

async function runTickInner(db: Db, now: () => Date, started: Date): Promise<TickResult> {
  const state = await db.loadState();
  const g = gate(state.kv, state.resident);
  const payload: TickPayload = {
    tick: {
      started_at: started.toISOString(),
      ended_at: now().toISOString(),
      mode: g.run ? "idle" : "skipped",
      provider: null,
      ok: true,
      error: g.run ? null : g.reason,
    },
  };
  payload.log_entries = [
    tickLog(payload.tick.mode, g.run ? "empty tick" : `tick skipped: ${g.reason}`),
  ];
  if (g.run) payload.resident = { last_tick_at: started.toISOString() };
  const res = await db.commitTick(payload);
  return { ran: g.run, reason: g.run ? "empty" : g.reason, tick_id: res.tick_id };
}

export { runMindTick, describeChoice } from "./pipeline";
export type { MindTickDeps, MindTickResult } from "./pipeline";
export { MemoryRows } from "./memory-log";
export type { TickLog, TickRows, EventInput } from "./ports";
export { genesis, readMind } from "./state";
export type { MindState } from "./state";
