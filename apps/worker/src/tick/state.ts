// The mind-tick state: world, body, organism (HIDDEN) plus what the Resident itself has said and learned.
// Persisted as one JSON blob in kv `mind` (one read, one write per tick). Hidden parts never go near buildPrompt:
// only senses.ts turns them into Resident-facing strings.
import type { Station } from "@truman/contracts";
import {
  createWorld,
  mapOf,
  starterInventory,
  type Inventory,
  type Pose,
  type WorldState,
} from "@truman/world";
import { newBody, STARTING_SKILLS, type BodyState, type Skills } from "@truman/body";
import { newOrganism, type OrganismRun, type Physiology } from "@truman/organism";

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
  /** Last tool result, untrusted. Shown once, then cleared. */
  last_result: string | null;
  action_seq: number;
  pending: PendingDecision | null;
  /** Key of the previous action (for habituation/repeat rules). */
  prev_key: string | null;
  /** Minutes since genesis of the last Resident decision. */
  last_decision_t: number;
}

export const HISTORY_CAP = 12;
export const LESSON_CAP = 12;
export const QUESTION_CAP = 6;

export function genesis(seed: number, bornMs: number): MindState {
  const world = createWorld(seed);
  const map = mapOf(world);
  return {
    v: 1,
    seed,
    born_ms: bornMs,
    world,
    body: newBody({ seed, birth_ms: bornMs }),
    organism: newOrganism(seed),
    physiology: null,
    pos: { ...map.stations.bed, heading: 0 },
    station: "bed",
    inventory: starterInventory(),
    skills: { ...STARTING_SKILLS },
    history: [],
    lessons: [],
    questions: [],
    goals: [],
    beliefs: [],
    last_result: null,
    action_seq: 0,
    pending: null,
    prev_key: null,
    last_decision_t: -1e9,
  };
}

/** Reads the blob from kv; null when absent or from another version. */
export function readMind(kv: Record<string, unknown>): MindState | null {
  const raw = kv["mind"];
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Partial<MindState>;
  if (m.v !== 1 || !m.world || !m.body || !m.organism) return null;
  return raw as MindState;
}

export const clock = (m: MindState): number => m.world.t;
export const isoAt = (m: MindState, t: number): string =>
  new Date(m.born_ms + t * 60000).toISOString();
