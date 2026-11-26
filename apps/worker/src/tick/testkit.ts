// Test kit ($0, no network): a stateful in-memory Db that behaves like the kv + resident row + tick_commit RPC, and
// a scripted "agent" that answers FakeProvider calls. The agent reads the engine state through the Db (tests only);
// it is a stand-in for an LLM, never part of the production path.
import { environmentAt, findItem, invCount } from "@truman/world";
import type { CommitResult, Db, LoadedState, TickPayload } from "../db/types";
import type { GovernorConfig } from "../governor";
import { FakeProvider } from "../llm";
import type { LlmProvider, RawRequest } from "../llm";
import { LogWriter } from "../log";
import type { Tools } from "../tools";
import { MemoryRows } from "./memory-log";
import { runMindTick, type MindTickResult } from "./pipeline";
import type { MindState } from "./state";

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

export class SimDb implements Db {
  kv: Record<string, unknown> = { world_seed: 7 };
  resident: Record<string, unknown> | null = { id: 1, status: "running" };
  payloads: TickPayload[] = [];
  loads = 0;
  private nextLog = 1;
  async loadState(): Promise<LoadedState> {
    this.loads++;
    return { resident: clone(this.resident), kv: clone(this.kv) };
  }
  async commitTick(p: TickPayload): Promise<CommitResult> {
    this.payloads.push(clone(p));
    if (p.kv) Object.assign(this.kv, clone(p.kv));
    if (p.resident) this.resident = { ...this.resident, ...clone(p.resident) };
    const log_ids: Record<string, number> = {};
    for (const e of p.log_entries ?? []) {
      const ref = (e as { ref?: string }).ref;
      if (ref) log_ids[ref] = this.nextLog;
      this.nextLog++;
    }
    return { tick_id: this.payloads.length, log_ids };
  }
  get mind(): MindState | null {
    return (this.kv["mind"] as MindState | undefined) ?? null;
  }
}

const NEUTRAL_REVIEW = {
  what_happened: "It went about as I thought.",
  cause: "I did what I meant to do.",
  expectation_met: "yes" as const,
  lesson: "If I keep doing the plain things, the day goes on.",
  feeling_description: "My body settled a little after that.",
  new_questions: [] as string[],
  citations: [] as string[],
};

const STATIONS = ["window", "clearing", "river", "forest_edge", "desk"] as const;

/** A sensible survivor. Uses engine state because it stands in for a mind that reads its own body. */
export function competentAction(m: MindState, step: number): Record<string, unknown> {
  const b = m.body;
  const env = environmentAt(m.world, m.pos);
  const inCabin = env.shelter === "cabin";
  const hour = (m.world.t % 1440) / 60;
  const night = hour >= 21.5 || hour < 5.5;
  const cold = env.ambient_temp_c < 12 || b.core_temp < 36.4;
  const wood = invCount(m.inventory, "firewood");
  const jar = findItem(m.inventory, "water jar");
  const jarFill = Number((jar?.props as { fill?: number } | undefined)?.fill ?? 0);
  const base = (thought: string, intent: string, expectation: string) => ({
    thought,
    intent,
    expectation,
  });
  const at = (s: string) => m.station === s;

  if (b.wounds.some((w) => !w.treated && w.severity > 0.05))
    return {
      type: "treat_wound",
      ...base("My hand is cut.", "Clean and bind the cut.", "It will stop hurting so much."),
    };
  if (b.hydration < 60) {
    if (jarFill > 0)
      return {
        type: "drink",
        source: "jar",
        ...base("My mouth is dry.", "Drink from the jar.", "My mouth will feel better."),
      };
    if (at("river"))
      return {
        type: "drink",
        source: "river",
        ...base("My mouth is dry.", "Drink at the river.", "My mouth will feel better."),
      };
    return {
      type: "move_to",
      station: "river",
      ...base("My mouth is dry.", "Go to the water.", "I can drink there."),
    };
  }
  if (b.satiety < 45) {
    for (const food of ["dried food", "fruit", "roots", "berries"])
      if (invCount(m.inventory, food) > 0)
        return {
          type: "eat",
          item: food,
          ...base(
            "There is an empty feeling in me.",
            `Eat the ${food}.`,
            "The empty feeling will ease.",
          ),
        };
    if (at("forest_edge") || at("clearing"))
      return {
        type: "gather",
        target: "roots",
        ...base("I need food.", "Dig for roots.", "I will find something to eat."),
      };
    return {
      type: "move_to",
      station: "forest_edge",
      ...base("I need food.", "Go where plants grow.", "I will find food there."),
    };
  }
  if (!inCabin && (night || cold || b.stamina < 25))
    return {
      type: "move_to",
      station: "bed",
      ...base("It is time to go in.", "Get back to the cabin.", "It will be warmer inside."),
    };
  if (inCabin && (cold || night) && wood >= 3 && env.fire_heat_c < 1)
    return {
      type: "make_fire",
      ...base("It is cold in here.", "Light the hearth.", "The room will warm."),
    };
  if (inCabin && (night || b.sleep_pressure > 0.8 || b.stamina < 25))
    return {
      type: "rest",
      hours: 8,
      ...base("I am worn out.", "Lie down and sleep.", "I will wake restored."),
    };
  if (wood < 4) {
    if (at("forest_edge"))
      return {
        type: "chop",
        target: "tree",
        ...base("The wood is low.", "Cut wood.", "I will have more logs."),
      };
    return {
      type: "move_to",
      station: "forest_edge",
      ...base("The wood is low.", "Go to the trees.", "I can cut wood there."),
    };
  }
  const k = step % 6;
  if (k === 0)
    return {
      type: "look_at",
      target: "the trees",
      ...base("What is out there?", "Look closely.", "I will notice something."),
    };
  if (k === 1)
    return {
      type: "write_journal",
      text: "A quiet stretch. I kept to what needed doing.",
      ...base("I want to remember this.", "Write it down.", "The words will stay."),
    };
  if (k === 2)
    return {
      type: "move_to",
      station: STATIONS[step % STATIONS.length]!,
      ...base("I will walk a little.", "Stretch my legs.", "I will see something new."),
    };
  if (k === 3)
    return {
      type: "web_search",
      query: "how do rivers form",
      ...base("The river is on my mind.", "Ask the terminal.", "It will tell me something."),
    };
  if (k === 4)
    return {
      type: "think",
      ...base("What do I want?", "Think it over.", "I will understand a bit more."),
    };
  return {
    type: "rest",
    hours: 1,
    ...base("A short rest.", "Rest a while.", "I will feel steadier."),
  };
}

export interface AgentOptions {
  /** Lets a test pick the action; defaults to competentAction. */
  policy?: (m: MindState, step: number) => Record<string, unknown>;
}

const NEUTRAL_APPRAISAL = {
  appraisal: {
    novelty: 0.4,
    pleasantness: 0.2,
    goal_relevance: 0.3,
    goal_congruence: 0.2,
    predictedness: 0.5,
    controllability: 0.6,
    agency: "world",
    self_compatibility: 0,
    social_relevance: 0,
    threat: 0.1,
    loss: 0,
    vastness_beauty: 0.2,
    contamination: 0,
    anticipation: 0.3,
  },
  consequences: ["something new was noticed"],
  prediction_error: 0.3,
};

/** FakeProvider wired to the SimDb: resident calls get a competent action (+ review), interpreter calls get numbers. */
export function makeAgent(db: SimDb, opts: AgentOptions = {}): FakeProvider {
  const policy = opts.policy ?? competentAction;
  let step = 0;
  return new FakeProvider("fake", (req: RawRequest) => {
    if (req.role === "interpreter") return NEUTRAL_APPRAISAL;
    const m = db.mind;
    const action = m
      ? policy(m, step++)
      : {
          type: "think",
          thought: "Where am I?",
          intent: "Take stock.",
          expectation: "I will see.",
        };
    return m?.pending ? { review: NEUTRAL_REVIEW, action } : { action };
  });
}

export interface SimOptions {
  days: number;
  start?: Date;
  stepMin?: number;
  db?: SimDb;
  providers?: (db: SimDb) => LlmProvider[];
  tools?: Tools;
  governor?: GovernorConfig;
  /** Called before each tick (e.g. to flip the kill switch). */
  before?: (k: number, db: SimDb) => void;
}

/** Runs the real mind tick every `stepMin` simulated minutes against a SimDb. */
export async function simulate(
  o: SimOptions,
): Promise<{ db: SimDb; results: MindTickResult[]; providers: LlmProvider[] }> {
  const db = o.db ?? new SimDb();
  const providers = o.providers ? o.providers(db) : [makeAgent(db)];
  const start = o.start ?? new Date("2026-03-01T06:30:00Z");
  const step = o.stepMin ?? 10;
  const n = Math.floor((o.days * 1440) / step);
  const results: MindTickResult[] = [];
  for (let k = 0; k < n; k++) {
    o.before?.(k, db);
    const t = new Date(start.getTime() + k * step * 60000);
    results.push(
      await runMindTick({
        db,
        log: new LogWriter(),
        rows: new MemoryRows(),
        providers,
        tools: o.tools,
        now: () => t,
        governor: o.governor,
      }),
    );
  }
  return { db, results, providers };
}
