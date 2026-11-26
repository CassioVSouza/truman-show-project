import { DEFAULT_ORGANISM_CONFIG, type OrganismConfig } from "./config";
import { clamp, unitAt } from "./rng";
import { bodyDrives } from "./survival";
import {
  PHYSIOLOGY_KEYS,
  type BodySignals,
  type OrganismState,
  type Physiology,
  type PhysiologyKey,
  type Temperament,
} from "./types";

type Weights = Record<string, number>;
interface Channel {
  bias: number;
  w: Weights;
  lo: number;
  hi: number;
}

/** Weighted maps from organism state + body drives to the 21 physiology channels (config, not story). */
export const PHYSIOLOGY_MAP: Record<PhysiologyKey, Channel> = {
  heart_rate: {
    bias: 62,
    w: {
      arousal: 38,
      pain: 22,
      stress_load: 10,
      fever: 14,
      heat: 8,
      thirst: 6,
      weak: 6,
      asleep: -14,
    },
    lo: 38,
    hi: 190,
  },
  heart_force: {
    bias: 0.25,
    w: { arousal: 0.5, stress_load: 0.2, pain: 0.1, asleep: -0.1 },
    lo: 0,
    hi: 1,
  },
  breath_rate: {
    bias: 13,
    w: { arousal: 9, pain: 4, fever: 6, heat: 3, asleep: -3 },
    lo: 6,
    hi: 45,
  },
  breath_depth: {
    bias: 0.5,
    w: { tension: -0.3, calm: 0.25, pain: -0.2, asleep: 0.15, arousal: 0.15 },
    lo: 0,
    hi: 1,
  },
  muscle_tension: { bias: 0.1, w: { tension: 0.6, shiver: 0.3, asleep: -0.1 }, lo: 0, hi: 1 },
  hand_tremor: {
    bias: 0,
    w: { weak: 0.4, cold: 0.3, hunger: 0.2, arousal: 0.15, stress_load: 0.15 },
    lo: 0,
    hi: 1,
  },
  skin_flush: { bias: 0, w: { heat: 0.6, fever: 0.5, arousal: 0.15 }, lo: 0, hi: 1 },
  chest_warmth: {
    bias: 0.15,
    w: { bonding: 0.4, valence: 0.2, reward_anticipation: 0.2, cold: -0.4 },
    lo: 0,
    hi: 1,
  },
  chest_pressure: {
    bias: 0,
    w: { stress_load: 0.5, pain: 0.2, vigilance: 0.2, coherence_need: 0.1 },
    lo: 0,
    hi: 1,
  },
  throat_tightness: {
    bias: 0,
    w: { stress_load: 0.35, vigilance: 0.25, thirst: 0.35, nausea: 0.25 },
    lo: 0,
    hi: 1,
  },
  gut_knot: { bias: 0, w: { stress_load: 0.4, hunger: 0.5, nausea: 0.6 }, lo: 0, hi: 1 },
  gut_flutter: {
    bias: 0,
    w: { arousal: 0.25, vigilance: 0.2, reward_anticipation: 0.3 },
    lo: 0,
    hi: 1,
  },
  pupil_light_sensitivity: {
    bias: 0.3,
    w: { arousal: 0.3, fever: 0.3, mental_fatigue: 0.15 },
    lo: 0,
    hi: 1,
  },
  goosebumps: { bias: 0, w: { cold: 0.7, arousal: 0.2, shiver: 0.2 }, lo: 0, hi: 1 },
  tear_pressure: {
    bias: 0,
    w: { stress_load: 0.3, pain: 0.25, social_deprivation: 0.15, stability: -0.15 },
    lo: 0,
    hi: 1,
  },
  face_tension: { bias: 0.05, w: { tension: 0.5, pain: 0.25 }, lo: 0, hi: 1 },
  heaviness: {
    bias: 0,
    w: { mental_fatigue: 0.4, rest_need: 0.45, weak: 0.4, illness: 0.3 },
    lo: 0,
    hi: 1,
  },
  head_pressure: {
    bias: 0,
    w: { stress_load: 0.25, thirst: 0.45, fever: 0.3, mental_fatigue: 0.25 },
    lo: 0,
    hi: 1,
  },
  posture_openness: {
    bias: 0.6,
    w: { valence: 0.2, stress_load: -0.5, cold: -0.4, pain: -0.3, weak: -0.3 },
    lo: 0,
    hi: 1,
  },
  pain_intensity: { bias: 0, w: { pain: 1 }, lo: 0, hi: 1 },
  urge_to_move: {
    bias: 0.05,
    w: { restlessness: 0.3, arousal: 0.3, cold: 0.3, info_hunger: 0.1, asleep: -0.1 },
    lo: 0,
    hi: 1,
  },
};

export function physiologySources(s: OrganismState, b: BodySignals): Record<string, number> {
  const d = bodyDrives(b);
  return {
    ...s,
    ...d,
    fever: b.fever,
    nausea: b.nausea,
    illness: b.illness,
    shiver: b.shiver,
    sweat: b.sweat,
    asleep: b.asleep ? 1 : 0,
    pain: Math.max(s.pain, b.pain),
  };
}

/**
 * Physiology vector from organism state and body: weighted maps + seeded noise + smoothing with the previous
 * sample (inertia). Deterministic for the same (temperament.seed, tMin).
 */
export function derivePhysiology(
  s: OrganismState,
  b: BodySignals,
  temperament: Temperament,
  tMin: number,
  prev?: Physiology,
  cfg: OrganismConfig = DEFAULT_ORGANISM_CONFIG,
): Physiology {
  const src = physiologySources(s, b);
  const out = {} as Physiology;
  PHYSIOLOGY_KEYS.forEach((k, i) => {
    const ch = PHYSIOLOGY_MAP[k];
    let v = ch.bias;
    for (const [name, w] of Object.entries(ch.w)) v += w * (src[name] ?? 0);
    const range = ch.hi - ch.lo;
    v += (unitAt(temperament.seed, Math.floor(tMin) * 31 + i) * 2 - 1) * cfg.noiseSd * range;
    v = clamp(v, ch.lo, ch.hi);
    const p = prev?.[k];
    out[k] = p === undefined ? v : p + (v - p) * (1 - cfg.physiologySmoothing);
  });
  return out;
}
