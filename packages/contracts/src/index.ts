import { z } from "zod";

export const SCHEMA_VERSION = 1;

export const Station = z.enum([
  "desk", "bed", "journal_table", "window", "door", "river", "forest_edge", "clearing", "mirror_pool",
]);
export type Station = z.infer<typeof Station>;

// ---------- Action: Resident (LLM) -> engine ----------
// intent + expectation are mandatory so every act is explainable and testable against its outcome.
const base = {
  thought: z.string().max(600),
  intent: z.string().min(3).max(300),        // why I do this now
  expectation: z.string().min(3).max(300),   // what I think will happen
  ideas: z.array(z.string().max(300)).max(3).optional(),
};

export const Action = z.discriminatedUnion("type", [
  z.object({ type: z.literal("think"), ...base }),
  z.object({ type: z.literal("move_to"), station: Station, ...base }),
  z.object({ type: z.literal("web_search"), query: z.string().min(2).max(200), ...base }),
  z.object({ type: z.literal("read_page"), url: z.string().url().max(500), ...base }),
  z.object({ type: z.literal("write_journal"), text: z.string().min(1).max(2000), ...base }),
  z.object({ type: z.literal("rest"), hours: z.number().int().min(1).max(8), ...base }),
  z.object({ type: z.literal("look_at"), target: z.string().max(80), ...base }),
  // survival macro-actions (doc 10); duration is computed by the engine, not chosen by the LLM
  z.object({ type: z.literal("eat"), item: z.string().max(80), ...base }),
  z.object({ type: z.literal("drink"), source: z.string().max(80), ...base }),
  z.object({ type: z.literal("gather"), target: z.string().max(80), minutes: z.number().int().min(5).max(180).optional(), ...base }),
  z.object({ type: z.literal("make_fire"), ...base }),
  z.object({ type: z.literal("tend_fire"), ...base }),
  z.object({ type: z.literal("cook"), item: z.string().max(80), ...base }),
  z.object({ type: z.literal("boil_water"), ...base }),
  z.object({ type: z.literal("wear"), item: z.string().max(80), remove: z.boolean().optional(), ...base }),
  z.object({ type: z.literal("treat_wound"), wound_id: z.number().int().optional(), ...base }),
  z.object({ type: z.literal("use_item"), item: z.string().max(80), target: z.string().max(80).optional(), ...base }),
  z.object({ type: z.literal("repair_shelter"), ...base }),
  z.object({ type: z.literal("fish"), ...base }),
  z.object({ type: z.literal("chop"), target: z.string().max(80), ...base }),
]);
export type Action = z.infer<typeof Action>;

// ---------- Outcome review: Resident, produced inside the NEXT decide call ----------
export const OutcomeReview = z.object({
  what_happened: z.string().max(400),
  cause: z.string().max(400),                      // its own causal explanation
  expectation_met: z.enum(["yes", "partly", "no"]),
  lesson: z.string().max(300).optional(),          // if-then rule it learned
  feeling_description: z.string().max(500),        // in ITS words; system never supplies labels
  new_questions: z.array(z.string().max(200)).max(3),
  goal_update: z.string().max(200).optional(),
  belief_update: z.object({ hypothesis: z.string().max(300), confidence: z.number().min(0).max(1), evidence: z.string().max(300) }).optional(),
  citations: z.array(z.string().max(500)).max(6),  // URL or memory:<id>
});
export type OutcomeReview = z.infer<typeof OutcomeReview>;

export const DecideOutput = z.object({ review: OutcomeReview.optional(), action: Action });
export type DecideOutput = z.infer<typeof DecideOutput>;

// ---------- Hidden layer: NEVER included in any Resident prompt ----------
const unit = z.number().min(0).max(1);
const signed = z.number().min(-1).max(1);

export const Appraisal = z.object({
  novelty: unit, pleasantness: signed, goal_relevance: unit, goal_congruence: signed,
  predictedness: unit, controllability: unit, agency: z.enum(["self", "other", "world"]),
  self_compatibility: signed, social_relevance: unit, threat: unit, loss: unit,
  vastness_beauty: unit, contamination: unit, anticipation: unit,
});
export type Appraisal = z.infer<typeof Appraisal>;

export const InterpreterOutput = z.object({
  appraisal: Appraisal,
  consequences: z.array(z.string().max(200)).max(5),   // factual world consequences
  prediction_error: unit,                              // expectation vs outcome
});
export type InterpreterOutput = z.infer<typeof InterpreterOutput>;

export const OrganismState = z.object({
  valence: signed, arousal: unit,
  reward_anticipation: unit, stress_load: unit, bonding: unit, vigilance: unit,
  calm: unit, comfort: unit, stability: unit,
  info_hunger: unit, expression_pressure: unit, social_deprivation: unit,
  mental_fatigue: unit, rest_need: unit, restlessness: unit, coherence_need: unit,
  pain: unit, tension: unit,
});
export type OrganismState = z.infer<typeof OrganismState>;

export const Physiology = z.object({
  heart_rate: z.number(), heart_force: unit, breath_rate: z.number(), breath_depth: unit,
  muscle_tension: unit, hand_tremor: unit, skin_flush: unit, chest_warmth: unit, chest_pressure: unit,
  throat_tightness: unit, gut_knot: unit, gut_flutter: unit, pupil_light_sensitivity: unit,
  goosebumps: unit, tear_pressure: unit, face_tension: unit, heaviness: unit, head_pressure: unit,
  posture_openness: unit, pain_intensity: unit, urge_to_move: unit,
});
export type Physiology = z.infer<typeof Physiology>;

// ---- Body / survival truth (engine + spectators only; NEVER in Resident prompts) ----
export const Wound = z.object({
  id: z.number().int(), type: z.enum(["cut", "bruise", "burn", "sprain", "bite"]),
  location: z.string(), severity: unit, infected: z.boolean(), treated: z.boolean(),
});
export const BodyState = z.object({
  health: z.number().min(0).max(100),          // the "life bar"
  satiety: z.number().min(0).max(100), energy_reserve: z.number().min(0).max(100),
  hydration: z.number().min(0).max(100),
  core_temp: z.number(), skin_temp: z.number(), wetness: unit,
  stamina: z.number().min(0).max(100), sleep_pressure: unit, immune: unit,
  wounds: z.array(Wound), conditions: z.array(z.object({ name: z.string(), severity: unit, since: z.string().datetime() })),
  alive: z.boolean(), cause_of_death: z.string().nullable(),
});
export type BodyState = z.infer<typeof BodyState>;
export const Skills = z.record(z.number().min(0).max(100));
export const InventoryItem = z.object({ item: z.string(), qty: z.number(), condition: unit.optional(), props: z.record(z.unknown()).optional() });

export const EmotionLabel = z.object({ label: z.string(), weight: unit }); // spectators/Lab only
export const Temperament = z.object({
  sensitivity: z.record(z.number()), baselines: z.record(z.number()), decay_minutes: z.record(z.number()),
  habituation_rate: z.number(),
});

// ---------- Log (canonical, append-only) ----------
export const LogKind = z.enum([
  "thought", "idea", "action", "outcome_review", "lesson", "journal", "dream", "memory_write", "memory_recall",
  "discovery", "question", "belief", "goal", "feeling_description", "perception", "sensation",
  "organism_sample", "physiology", "appraisal", "emotion_label", "causal_link", "llm_trace", "tool_call",
  "governor", "error", "system", "translation",
]);
export const LogEntry = z.object({
  id: z.number().int(), ts: z.string().datetime(), tick_id: z.number().int().nullable(),
  kind: LogKind, category: z.enum(["life", "lab"]), text: z.string(), data: z.record(z.unknown()),
  caused_by: z.number().int().nullable(), lang: z.string(), hidden: z.boolean(),
});
export type LogEntry = z.infer<typeof LogEntry>;

// ---------- Events: engine -> viewer ----------
const Vec = z.object({ x: z.number(), z: z.number() });
const ev = <K extends string, D extends z.ZodTypeAny>(kind: K, data: D) =>
  z.object({
    v: z.literal(SCHEMA_VERSION), seq: z.number().int().nonnegative(),
    t_start: z.string().datetime(), t_end: z.string().datetime(),
    actor: z.enum(["resident", "world"]), kind: z.literal(kind), data, log_id: z.number().int().nullable(),
  });

export const Event = z.discriminatedUnion("kind", [
  ev("walk", z.object({ waypoints: z.array(Vec).min(2), speed: z.number().positive() })),
  ev("anim", z.object({ name: z.string(), station: Station.optional() })),
  ev("thought", z.object({ text: z.string() })),
  ev("web_visit", z.object({ url: z.string().url(), title: z.string().optional() })),
  ev("journal", z.object({ id: z.number().int(), preview: z.string() })),
  ev("body", Physiology.pick({ heart_rate: true, breath_rate: true, posture_openness: true, heaviness: true, muscle_tension: true })),
  ev("sleep_start", z.object({})),
  ev("sleep_end", z.object({})),
  ev("dream", z.object({ id: z.number().int(), text: z.string() })),
  ev("world", z.object({ weather: z.string(), time_of_day: z.enum(["dawn", "day", "dusk", "night"]) })),
  ev("consume", z.object({ item: z.string(), kind: z.enum(["eat", "drink"]) })),
  ev("gather", z.object({ target: z.string(), gained: z.array(z.object({ item: z.string(), qty: z.number() })) })),
  ev("fire", z.object({ state: z.enum(["lit", "burning", "dying", "out"]), x: z.number(), z: z.number() })),
  ev("injury", z.object({ wound_id: z.number().int(), type: z.string(), location: z.string() })),
  ev("death", z.object({ cause: z.string() })),
  ev("status", z.object({ status: z.enum(["running", "paused", "degraded", "hibernating", "dead"]), reason: z.string().optional() })),
]);
export type Event = z.infer<typeof Event>;

export const Snapshot = z.object({
  v: z.literal(SCHEMA_VERSION), seq: z.number().int(), generated_at: z.string().datetime(),
  world: z.object({ seed: z.number().int(), weather: z.string(), entities: z.array(z.object({ id: z.string(), type: z.string(), x: z.number(), z: z.number(), health: z.number().optional(), appearance: z.unknown() })) }),
  resident: z.object({ pose: z.object({ x: z.number(), z: z.number(), heading: z.number() }), station: Station.nullable(), body: Physiology, vitals: BodyState, inventory: z.array(InventoryItem), phase: z.string() }),
  status: z.string(),
});
export type Snapshot = z.infer<typeof Snapshot>;

// ---------- Search ----------
export const SearchRequest = z.object({
  q: z.string().min(1).max(200), kinds: z.array(LogKind).optional(), category: z.enum(["life", "lab"]).optional(),
  from: z.string().datetime().optional(), to: z.string().datetime().optional(),
  lang: z.enum(["en", "pt"]).default("en"), before_id: z.number().int().optional(), limit: z.number().int().max(100).default(30),
});
export const SearchResponse = z.object({ results: z.array(LogEntry.extend({ rank: z.number() })), next_before_id: z.number().int().nullable() });

// ---------- Providers ----------
export type LLMErrorKind = "RateLimited" | "QuotaExhausted" | "InvalidJson" | "Refused" | "Unavailable";
export interface Usage { tokens_in: number; tokens_out: number; latency_ms: number }
export interface LLMProvider {
  id: string;
  generate<T>(req: {
    role: "resident" | "interpreter" | "dream" | "translate";
    system: string; messages: { role: "user" | "assistant"; content: string }[];
    schema: z.ZodType<T>; temperature: number; maxOutputTokens: number; images?: string[];
  }): Promise<{ data: T; usage: Usage; trace_id: number }>;
}

export const ToolResult = z.object({
  ok: z.boolean(), source_url: z.string().url().optional(), title: z.string().optional(),
  text: z.string(), fetched_at: z.string().datetime(), untrusted: z.literal(true),
});
export type ToolResult = z.infer<typeof ToolResult>;
