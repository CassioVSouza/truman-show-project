// Local, structurally compatible with packages/contracts (BodyState, Wound, Skills).
// Extra fields are engine-internal. Nothing here is ever rendered to the Resident.

export type WoundType = "cut" | "bruise" | "burn" | "sprain" | "bite";
export type DeathCause =
  "starvation" | "dehydration" | "exposure" | "injury" | "illness" | "poisoning";
export type ConditionName = "food_poisoning" | "fever" | "cold" | "infection";

export interface Wound {
  id: number;
  type: WoundType;
  location: string;
  severity: number; // 0..1
  infected: boolean;
  treated: boolean;
  age_min: number;
  infect_at: number | null; // pre-rolled at creation: untreated age (min) at which it infects
}

export interface Condition {
  name: ConditionName;
  severity: number; // 0..1
  since: string; // ISO
  // engine internals
  source: "toxin" | "pathogen" | "wound" | "exposure" | "body";
  peak: number;
  ramp_min: number;
  age_min: number;
}

/** Local structural interface; align with the contracts environment type when it lands. */
export interface BodyEnvironment {
  ambient_temp_c: number;
  wind: number; // 0..1
  rain: number; // 0..1 (precipitation reaching open ground)
  daylight: number; // 0..1
  shelter: number; // 0..1 (roof/walls between body and weather)
  fire_warmth: number; // 0..1 (heat from a burning fire close by)
  immersion?: number; // 0..1 (body in water)
  /** 0..1 cover from a cabin/roof/canopy for resting; undefined = unknown, treated as fully covered. */
  rest_cover?: number;
}

export interface Activity {
  asleep: boolean;
  effort: number; // 0 resting awake, 1 baseline awake, 2 work, 3 heavy
}

export type ReflexKind =
  | "shiver"
  | "sweat"
  | "withdraw_from_fire"
  | "flinch"
  | "vomit"
  | "micro_sleep"
  | "faint"
  | "stumble"
  | "wound_infected"
  | "illness_started"
  | "illness_resolved"
  | "injury"
  | "death";

export interface ReflexEvent {
  t: number; // minutes since birth
  kind: ReflexKind;
  detail: string; // engine/spectator text (may be technical); never fed to the Resident directly
  data?: Record<string, number | string | boolean>;
}

export interface WakeRequest {
  t: number;
  reason: string;
  in_min: number; // schedule an extra tick within this many minutes
}

export interface HistorySample {
  t: number;
  health: number;
  satiety: number;
  energy_reserve: number;
  hydration: number;
  core_temp: number;
  stamina: number;
}

export interface DeathReport {
  cause: DeathCause;
  died_at_min: number;
  died_at_iso: string;
  contributions: Record<DeathCause, number>; // recent weighted health drained per cause
  chain: string[]; // ordered human-readable causal chain for spectators
  final_vitals: Record<string, number>;
  timeline: HistorySample[];
  events: ReflexEvent[];
}

export interface BodyState {
  // ---- contract fields ----
  health: number;
  satiety: number;
  energy_reserve: number;
  hydration: number;
  core_temp: number;
  skin_temp: number;
  wetness: number;
  stamina: number;
  sleep_pressure: number;
  immune: number;
  wounds: Wound[];
  conditions: Condition[];
  alive: boolean;
  cause_of_death: DeathCause | null;
  // ---- engine internals ----
  nutrient_balance: number; // 0..1, variety matters slowly
  insulation: number; // worn clothing/blanket warmth (0..~1.5)
  shiver: number; // 0..1 (last step)
  sweat: number; // 0..1 (last step)
  asleep: boolean;
  t: number; // minutes since birth
  birth_ms: number; // epoch ms of t=0 (only for ISO stamps)
  seed: number;
  rng_ctr: number;
  immune_base: number;
  chill_min: number;
  micro_sleep_until: number;
  unconscious_until: number;
  next_wound_id: number;
  prev_fire: number;
  ledger: Record<DeathCause, number>;
  flags: Record<string, boolean>;
  marks: Record<string, number>; // first time something happened (for the causal chain)
  history: HistorySample[];
  timeline: ReflexEvent[];
  death_report: DeathReport | null;
}

export type Skills = Record<string, number>;

export interface StepResult {
  state: BodyState;
  events: ReflexEvent[];
  wake: WakeRequest[];
}

/** Structural subset of the contracts `Environment` (world engine output) that the body needs. */
export interface WorldEnvironmentLike {
  ambient_temp_c: number;
  fire_heat_c: number;
  wind: number;
  wetness_rate: number;
  daylight: number;
  shelter?: "open" | "canopy" | "cabin";
  shelter_quality?: number;
}
