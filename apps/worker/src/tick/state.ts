// The mind-tick state: world, body, organism (HIDDEN) plus what the Resident itself has said and learned.
// Persisted as one JSON blob in kv `mind` (one read, one write per tick). Hidden parts never go near buildPrompt:
// only senses.ts turns them into Resident-facing strings.
import type { Station } from "@truman/contracts";
import {
  createWorld,
  mapOf,
  recoverWalkPosition,
  starterInventory,
  type Inventory,
  type Pose,
  type WorldState,
} from "@truman/world";
import { newBody, STARTING_SKILLS, type BodyState, type Skills } from "@truman/body";
import { newOrganism, type OrganismRun, type Physiology } from "@truman/organism";
import { DEFAULT_TIME_SCALE } from "../governor";
import type { MemoryItem } from "../memory";

export interface HistoryItem {
  seq: number;
  type: string;
  /** First-person prose of what the Resident did and meant (its own words). */
  did: string;
  intent: string;
  expectation: string;
  /** Plain words for what followed (Resident-facing; no numbers). */
  outcome: string;
  ok: boolean;
}

/** The decision awaiting its outcome review (written as one complete `decisions` row at the next tick). */
export interface PendingDecision {
  seq: number;
  action: Record<string, unknown>;
  intent: string;
  expectation: string;
  outcome: Record<string, unknown>;
  prediction_error: number;
}

export interface MindState {
  v: 1;
  seed: number;
  born_ms: number;
  world: WorldState;
  /** Fire state at the start of the last simulated macro-action, for mid-action snapshots. */
  actionFireStart?: Pick<WorldState, "t" | "fires">;
  body: BodyState;
  organism: OrganismRun;
  physiology: Physiology | null;
  pos: Pose;
  station: Station | null;
  inventory: Inventory;
  skills: Skills;
  // ---- what the Resident wrote or learned (its own words; nothing seeded) ----
  history: HistoryItem[];
  lessons: string[];
  questions: string[];
  goals: string[];
  beliefs: string[];
  memories: MemoryItem[];
  next_memory_id: number;
  /** Last tool result, untrusted. Shown once, then cleared. */
  last_result: string | null;
  action_seq: number;
  pending: PendingDecision | null;
  /** Key of the previous action (for habituation/repeat rules). */
  prev_key: string | null;
  /** Minutes since genesis of the last Resident decision (world minutes). */
  last_decision_t: number;
  /** Last decision's real wall-clock time, using the nominal slot for scheduled ticks. */
  last_decision_ms?: number;
  /** Real wall-clock ms at which `clock_anchor_t` occurred. Absent on legacy 1x blobs (defaults to `born_ms`). */
  clock_anchor_ms?: number;
  /** World minutes at `clock_anchor_ms`. Absent on legacy 1x blobs (defaults to 0). */
  clock_anchor_t?: number;
  /** World minutes per real minute active from the anchor onwards. Absent on legacy 1x blobs (defaults to 1). */
  clock_scale?: number;
}

export const HISTORY_CAP = 12;
export const LESSON_CAP = 12;
export const QUESTION_CAP = 6;

export function genesis(seed: number, bornMs: number, timeScale = DEFAULT_TIME_SCALE): MindState {
  const world = createWorld(seed);
  const map = mapOf(world);
  const bedside = recoverWalkPosition(map, map.stations.bed) ?? map.stations.bed;
  return {
    v: 1,
    seed,
    born_ms: bornMs,
    world,
    body: newBody({ seed, birth_ms: bornMs }),
    organism: newOrganism(seed),
    physiology: null,
    pos: { ...bedside, heading: 0 },
    station: "bed",
    inventory: starterInventory(),
    skills: { ...STARTING_SKILLS },
    history: [],
    lessons: [],
    questions: [],
    goals: [],
    beliefs: [],
    memories: [],
    next_memory_id: 1,
    last_result: null,
    action_seq: 0,
    pending: null,
    prev_key: null,
    last_decision_t: -1e9,
    clock_anchor_ms: bornMs,
    clock_anchor_t: 0,
    clock_scale: timeScale,
  };
}

/** Reads the blob from kv; null when absent or from another version. */
export function readMind(kv: Record<string, unknown>): MindState | null {
  const raw = kv["mind"];
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Partial<MindState>;
  if (m.v !== 1 || !m.world || !m.body || !m.organism) return null;
  return {
    ...(raw as MindState),
    memories: Array.isArray(m.memories) ? m.memories : [],
    next_memory_id:
      typeof m.next_memory_id === "number" && m.next_memory_id >= 1 ? m.next_memory_id : 1,
  };
}

export const clock = (m: MindState): number => m.world.t;

/** Maps a real wall-clock timestamp (ms) to world minutes using the mind's clock anchor (legacy blobs default to 1x from born_ms). */
export function worldTimeAt(m: MindState, ms: number): number {
  const anchorMs = m.clock_anchor_ms ?? m.born_ms;
  const anchorT = m.clock_anchor_t ?? 0;
  const scale = m.clock_scale ?? 1;
  return Math.max(0, anchorT + ((ms - anchorMs) / 60000) * scale);
}

/**
 * Ensures the mind's clock anchor matches `timeScale`. When migrating a legacy 1x blob or changing `timeScale`,
 * re-anchors continuously at `(nowMs, worldTimeAt(m, nowMs))` so world time never jumps.
 */
export function anchorClock(m: MindState, nowMs: number, timeScale: number): MindState {
  if (
    m.clock_anchor_ms !== undefined &&
    m.clock_anchor_t !== undefined &&
    m.clock_scale === timeScale
  ) {
    return m;
  }
  return {
    ...m,
    clock_anchor_ms: nowMs,
    clock_anchor_t: worldTimeAt(m, nowMs),
    clock_scale: timeScale,
  };
}

/** Maps a world-minute timestamp `t` to a real wall-clock ISO string for viewer playback. */
export function isoAt(m: MindState, t: number): string {
  const anchorMs = m.clock_anchor_ms ?? m.born_ms;
  const anchorT = m.clock_anchor_t ?? 0;
  const scale = m.clock_scale ?? 1;
  return new Date(anchorMs + ((t - anchorT) / scale) * 60000).toISOString();
}
