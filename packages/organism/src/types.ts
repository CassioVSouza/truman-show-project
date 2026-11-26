// Hidden layer. Structurally compatible with packages/contracts (Appraisal, OrganismState, Physiology, Temperament).
// None of these names or numbers may ever reach the Resident; only sensation.ts output does.

export interface Appraisal {
  novelty: number; // 0..1
  pleasantness: number; // -1..1
  goal_relevance: number;
  goal_congruence: number; // -1..1
  predictedness: number;
  controllability: number;
  agency: "self" | "other" | "world";
  self_compatibility: number; // -1..1
  social_relevance: number;
  threat: number;
  loss: number;
  vastness_beauty: number;
  contamination: number;
  anticipation: number;
}

export const ORGANISM_KEYS = [
  "valence",
  "arousal",
  "reward_anticipation",
  "stress_load",
  "bonding",
  "vigilance",
  "calm",
  "comfort",
  "stability",
  "info_hunger",
  "expression_pressure",
  "social_deprivation",
  "mental_fatigue",
  "rest_need",
  "restlessness",
  "coherence_need",
  "pain",
  "tension",
] as const;
export type OrganismKey = (typeof ORGANISM_KEYS)[number];
export type OrganismState = Record<OrganismKey, number>;

export const PHYSIOLOGY_KEYS = [
  "heart_rate",
  "heart_force",
  "breath_rate",
  "breath_depth",
  "muscle_tension",
  "hand_tremor",
  "skin_flush",
  "chest_warmth",
  "chest_pressure",
  "throat_tightness",
  "gut_knot",
  "gut_flutter",
  "pupil_light_sensitivity",
  "goosebumps",
  "tear_pressure",
  "face_tension",
  "heaviness",
  "head_pressure",
  "posture_openness",
  "pain_intensity",
  "urge_to_move",
] as const;
export type PhysiologyKey = (typeof PHYSIOLOGY_KEYS)[number];
export type Physiology = Record<PhysiologyKey, number>;

export interface Temperament {
  sensitivity: Record<string, number>;
  baselines: Record<string, number>;
  decay_minutes: Record<string, number>;
  habituation_rate: number;
  seed: number; // engine-only; used for deterministic wording/noise
}

export type { BodySignals } from "@truman/contracts";

/** Survival channels (doc 08 extra vocabulary), 0..1 each. */
export interface SurvivalChannels {
  stomach_emptiness: number;
  stomach_ache: number;
  nausea: number;
  dry_mouth: number;
  thirst_head: number;
  shivering: number;
  numb_extremities: number;
  sweating: number;
  flushed_heat: number;
  fever_chills: number;
  dizziness: number;
  trembling_weakness: number;
  blurred_sight: number;
  ringing_ears: number;
  heavy_limbs: number;
  wounds: { location: string; type: string; intensity: number }[];
}

export interface HabituationEntry {
  level: number; // 0..1 (1 = fully habituated)
  t: number; // last exposure (minutes)
}

export interface OrganismRun {
  temperament: Temperament;
  state: OrganismState;
  habit: Record<string, HabituationEntry>;
  t: number; // minutes
}

export interface MemoryBodySnapshot {
  valence: number;
  arousal: number;
  stress_load: number;
  tension: number;
  pain: number;
  calm: number;
  comfort: number;
  intensity: number; // 0..1, how strong the encoded state was
}
