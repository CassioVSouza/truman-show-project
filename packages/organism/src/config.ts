// Tuning knobs (config, not story): baselines, decay constants, habituation, noise, weights.
import type { OrganismKey, OrganismState } from "./types";

export const DEFAULT_BASELINES: OrganismState = {
  valence: 0.1,
  arousal: 0.25,
  reward_anticipation: 0.2,
  stress_load: 0.1,
  bonding: 0.1,
  vigilance: 0.2,
  calm: 0.45,
  comfort: 0.55,
  stability: 0.55,
  info_hunger: 0.3,
  expression_pressure: 0.2,
  social_deprivation: 0.1,
  mental_fatigue: 0.05,
  rest_need: 0.05,
  restlessness: 0.15,
  coherence_need: 0.1,
  pain: 0,
  tension: 0.15,
};

/** Decay time constants in minutes (stress slow, arousal fast). */
export const DEFAULT_DECAY_MIN: Record<OrganismKey, number> = {
  valence: 120,
  arousal: 20,
  reward_anticipation: 40,
  stress_load: 360,
  bonding: 600,
  vigilance: 30,
  calm: 60,
  comfort: 90,
  stability: 240,
  info_hunger: 3000,
  expression_pressure: 2400,
  social_deprivation: 7200,
  mental_fatigue: 180,
  rest_need: 120,
  restlessness: 1500,
  coherence_need: 1200,
  pain: 30,
  tension: 45,
};

export interface OrganismConfig {
  baselines: OrganismState;
  decayMin: Record<OrganismKey, number>;
  sleepDecayMult: number; // while asleep, stress/arousal/tension relax faster
  temperamentJitter: number; // +/- fraction for sensitivity, baselines, decay
  habituationRate: [number, number];
  habituationRecoverMin: number;
  sensitizeAbove: number; // appraisal intensity above this sensitises instead of habituating
  physiologySmoothing: number; // 0..1 blend toward new physiology each sample
  noiseSd: number; // physiology noise, as fraction of channel range
  sensationThreshold: number;
  maxSensations: number;
  maxUrges: number;
  wordingWindowMin: number; // wording changes at most this often for the same feeling
  memoryReactivation: number;
  sleepAttenuationPerHour: number;
}

export const DEFAULT_ORGANISM_CONFIG: OrganismConfig = {
  baselines: DEFAULT_BASELINES,
  decayMin: DEFAULT_DECAY_MIN,
  sleepDecayMult: 0.5,
  temperamentJitter: 0.25,
  habituationRate: [0.15, 0.35],
  habituationRecoverMin: 720,
  sensitizeAbove: 0.7,
  physiologySmoothing: 0.6,
  noiseSd: 0.02,
  sensationThreshold: 0.2,
  maxSensations: 6,
  maxUrges: 3,
  wordingWindowMin: 180,
  memoryReactivation: 0.3,
  sleepAttenuationPerHour: 0.08,
};
