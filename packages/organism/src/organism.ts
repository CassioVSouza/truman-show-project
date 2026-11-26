import { DEFAULT_ORGANISM_CONFIG, type OrganismConfig } from "./config";
import { clamp, strHash, unitAt } from "./rng";
import { bodyDrives } from "./survival";
import {
  ORGANISM_KEYS,
  type Appraisal,
  type BodySignals,
  type MemoryBodySnapshot,
  type OrganismKey,
  type OrganismRun,
  type OrganismState,
  type Temperament,
} from "./types";

// ---------------- temperament (seeded, drawn once at genesis) ----------------
export function makeTemperament(
  seed: number,
  cfg: OrganismConfig = DEFAULT_ORGANISM_CONFIG,
): Temperament {
  const j = cfg.temperamentJitter;
  const draw = (tag: string) => unitAt(seed >>> 0, strHash(tag));
  const sensitivity: Record<string, number> = {};
  const baselines: Record<string, number> = {};
  const decay: Record<string, number> = {};
  for (const k of ORGANISM_KEYS) {
    sensitivity[k] = 1 + (draw(`s:${k}`) * 2 - 1) * j;
    decay[k] = cfg.decayMin[k] * (1 + (draw(`d:${k}`) * 2 - 1) * j);
    const span = k === "valence" ? 0.3 : 0.15;
    baselines[k] = clamp(
      cfg.baselines[k] + (draw(`b:${k}`) * 2 - 1) * span * j * 2,
      k === "valence" ? -1 : 0,
      1,
    );
  }
  const [lo, hi] = cfg.habituationRate;
  return {
    sensitivity,
    baselines,
    decay_minutes: decay,
    habituation_rate: lo + draw("hab") * (hi - lo),
    seed: seed >>> 0,
  };
}

export function newOrganism(
  seed: number,
  cfg: OrganismConfig = DEFAULT_ORGANISM_CONFIG,
): OrganismRun {
  const temperament = makeTemperament(seed, cfg);
  const state = {} as OrganismState;
  for (const k of ORGANISM_KEYS) state[k] = temperament.baselines[k] ?? 0;
  return { temperament, state, habit: {}, t: 0 };
}

/** Experience slowly shapes temperament (baseline drifts toward long-run mean, very slowly). */
export function shapeTemperament(
  t: Temperament,
  longRunMean: Partial<OrganismState>,
  rate = 0.002,
): Temperament {
  const baselines = { ...t.baselines };
  for (const [k, v] of Object.entries(longRunMean)) {
    const cur = baselines[k];
    if (cur !== undefined && v !== undefined) baselines[k] = cur + (v - cur) * rate;
  }
  return { ...t, baselines };
}

// ---------------- continuous dynamics ----------------
/** Targets each variable relaxes toward, from baselines and the body. Depends on body only (so stepping is exact). */
export function targets(t: Temperament, b: BodySignals): OrganismState {
  const d = bodyDrives(b);
  const base = (k: OrganismKey) => t.baselines[k] ?? 0;
  const sens = (k: OrganismKey) => t.sensitivity[k] ?? 1;
  const acute = Math.max(d.thirst, d.hunger * 0.8, d.cold, d.heat);
  const stress = clamp(
    base("stress_load") +
      sens("stress_load") * (0.55 * b.pain + 0.5 * acute + 0.4 * b.illness + 0.3 * d.weak),
    0,
    1,
  );
  const asleepMul = b.asleep ? 0.2 : 1;
  const out = {} as OrganismState;
  out.pain = clamp(b.pain * sens("pain"), 0, 1);
  out.stress_load = b.asleep ? stress * 0.7 : stress;
  out.arousal = clamp(
    (base("arousal") + 0.5 * b.pain + 0.3 * acute + 0.15 * d.weak) * sens("arousal") * asleepMul,
    0,
    1,
  );
  out.tension =
    clamp(base("tension") + 0.4 * b.pain + 0.35 * b.shiver + 0.3 * stress, 0, 1) *
    (b.asleep ? 0.5 : 1);
  out.comfort = clamp(0.8 - 0.75 * d.discomfort + (base("comfort") - 0.55), 0, 1);
  out.valence = clamp(
    base("valence") + 0.45 * (out.comfort - 0.5) - 0.5 * b.pain - 0.4 * acute,
    -1,
    1,
  );
  out.calm = clamp(base("calm") * (1 - stress) + (b.asleep ? 0.3 : 0) * (1 - stress), 0, 1);
  out.vigilance =
    clamp(base("vigilance") + 0.4 * stress + 0.2 * b.pain, 0, 1) * (b.asleep ? 0.4 : 1);
  out.stability = clamp(base("stability") + 0.15 - 0.6 * stress, 0, 1);
  out.reward_anticipation = clamp(base("reward_anticipation") * (1 - 0.5 * acute), 0, 1);
  out.bonding = base("bonding");
  out.rest_need = b.asleep ? 0 : clamp(Math.max(b.sleep_pressure, 1 - b.stamina / 100), 0, 1);
  out.mental_fatigue = b.asleep
    ? 0
    : clamp(base("mental_fatigue") + 0.85 * b.sleep_pressure + 0.2 * (1 - b.stamina / 100), 0, 1);
  // time-integrated drives rise toward a ceiling until satisfied by events
  out.info_hunger = b.asleep ? base("info_hunger") : 1;
  out.expression_pressure = b.asleep ? base("expression_pressure") : 0.9;
  out.social_deprivation = 1;
  out.restlessness = b.asleep ? base("restlessness") : 0.8;
  out.coherence_need = base("coherence_need");
  return out;
}

/** Exponential relaxation toward targets; exact for constant body signals, so any step size agrees. */
export function advanceOrganism(
  run: OrganismRun,
  body: BodySignals,
  minutes: number,
  cfg: OrganismConfig = DEFAULT_ORGANISM_CONFIG,
): OrganismRun {
  const tg = targets(run.temperament, body);
  const state = { ...run.state };
  for (const k of ORGANISM_KEYS) {
    let tau = run.temperament.decay_minutes[k] ?? cfg.decayMin[k];
    if (
      body.asleep &&
      (k === "stress_load" || k === "arousal" || k === "tension" || k === "vigilance")
    )
      tau *= cfg.sleepDecayMult;
    state[k] = state[k] + (tg[k] - state[k]) * (1 - Math.exp(-minutes / tau));
  }
  return { ...run, state, t: run.t + minutes };
}

// ---------------- appraisal -> impulses, with habituation ----------------
export function appraisalIntensity(a: Appraisal): number {
  return Math.max(
    Math.abs(a.pleasantness),
    a.threat,
    a.loss,
    a.novelty,
    a.vastness_beauty,
    a.contamination,
    a.social_relevance * 0.8,
  );
}

/** Raw deltas an appraisal would cause (before habituation and temperament). */
export function appraisalDeltas(a: Appraisal): Partial<OrganismState> {
  const pos = Math.max(0, a.pleasantness);
  return {
    valence: 0.45 * a.pleasantness + 0.25 * a.goal_congruence - 0.15 * a.loss,
    arousal:
      0.35 * a.novelty +
      0.4 * a.threat +
      0.2 * a.goal_relevance +
      0.2 * (1 - a.predictedness) +
      0.2 * a.vastness_beauty,
    reward_anticipation: 0.4 * a.anticipation * Math.max(0, a.goal_congruence + pos) * 0.7,
    stress_load: 0.35 * a.threat * (1 - a.controllability) + 0.25 * a.loss + 0.15 * a.contamination,
    bonding: 0.3 * a.social_relevance * pos,
    vigilance: 0.5 * a.threat + 0.2 * a.novelty,
    calm: -0.3 * a.threat + 0.2 * a.predictedness * pos,
    comfort: 0.2 * a.pleasantness,
    stability: 0.15 * a.self_compatibility - 0.2 * a.loss,
    info_hunger: -0.3 * a.novelty * a.goal_relevance,
    expression_pressure: 0.15 * (a.vastness_beauty + a.novelty),
    social_deprivation: -0.4 * a.social_relevance * pos,
    restlessness: -0.3 * a.novelty,
    coherence_need:
      0.4 * (1 - a.predictedness) * a.novelty + 0.3 * Math.max(0, -a.self_compatibility),
    tension: 0.3 * a.threat,
  };
}

/** Apply an appraisal to the organism. `key` identifies the stimulus type for habituation. */
export function applyAppraisal(
  run: OrganismRun,
  a: Appraisal,
  key: string,
  cfg: OrganismConfig = DEFAULT_ORGANISM_CONFIG,
): OrganismRun {
  const t = run.temperament;
  const h = run.habit[key];
  const recovered = h ? h.level * Math.exp(-(run.t - h.t) / cfg.habituationRecoverMin) : 0;
  const intensity = appraisalIntensity(a);
  const sensitized = intensity >= cfg.sensitizeAbove;
  const gain = (1 - recovered) * (sensitized ? 1.2 : 1);
  const deltas = appraisalDeltas(a);
  const state = { ...run.state };
  for (const k of ORGANISM_KEYS) {
    const dv = deltas[k];
    if (dv)
      state[k] = clamp(state[k] + dv * gain * (t.sensitivity[k] ?? 1), k === "valence" ? -1 : 0, 1);
  }
  const level = sensitized
    ? Math.max(0, recovered - 0.3)
    : recovered + t.habituation_rate * (1 - recovered);
  return { ...run, state, habit: { ...run.habit, [key]: { level, t: run.t } } };
}

// ---------------- rule-table appraisal for routine events (no LLM) ----------------
const NEUTRAL: Appraisal = {
  novelty: 0,
  pleasantness: 0,
  goal_relevance: 0,
  goal_congruence: 0,
  predictedness: 0.9,
  controllability: 0.8,
  agency: "self",
  self_compatibility: 0,
  social_relevance: 0,
  threat: 0,
  loss: 0,
  vastness_beauty: 0,
  contamination: 0,
  anticipation: 0,
};

export type RoutineEvent =
  | "walk"
  | "rest"
  | "sleep"
  | "wake"
  | "eat"
  | "drink"
  | "warm_by_fire"
  | "make_fire"
  | "repeat_action"
  | "quiet"
  | "minor_injury"
  | "sudden_injury"
  | "sickened"
  | "action_failed"
  | "action_succeeded"
  | "loud_noise"
  | "dusk"
  | "dawn";

const RULES: Record<RoutineEvent, Partial<Appraisal>> = {
  walk: {},
  rest: { pleasantness: 0.1 },
  sleep: { pleasantness: 0.1 },
  wake: { novelty: 0.1 },
  eat: { pleasantness: 0.5, goal_relevance: 0.6, goal_congruence: 0.7 },
  drink: { pleasantness: 0.4, goal_relevance: 0.6, goal_congruence: 0.7 },
  warm_by_fire: { pleasantness: 0.5, goal_relevance: 0.5, goal_congruence: 0.6 },
  make_fire: { pleasantness: 0.2, goal_relevance: 0.5, goal_congruence: 0.4, anticipation: 0.4 },
  repeat_action: { predictedness: 1 },
  quiet: { predictedness: 1, pleasantness: 0.05 },
  minor_injury: {
    pleasantness: -0.4,
    threat: 0.3,
    loss: 0.1,
    predictedness: 0.4,
    novelty: 0.3,
    controllability: 0.6,
    agency: "world",
  },
  sudden_injury: {
    pleasantness: -0.8,
    threat: 0.8,
    loss: 0.3,
    predictedness: 0.1,
    novelty: 0.6,
    controllability: 0.3,
    agency: "world",
  },
  sickened: {
    pleasantness: -0.6,
    threat: 0.5,
    contamination: 0.7,
    predictedness: 0.3,
    controllability: 0.3,
    agency: "world",
  },
  action_failed: {
    pleasantness: -0.3,
    goal_relevance: 0.6,
    goal_congruence: -0.5,
    predictedness: 0.3,
    novelty: 0.3,
  },
  action_succeeded: {
    pleasantness: 0.35,
    goal_relevance: 0.6,
    goal_congruence: 0.6,
    predictedness: 0.5,
  },
  loud_noise: {
    novelty: 0.7,
    threat: 0.4,
    predictedness: 0.1,
    controllability: 0.4,
    agency: "world",
  },
  dusk: { vastness_beauty: 0.2, predictedness: 0.9 },
  dawn: { vastness_beauty: 0.3, pleasantness: 0.2, predictedness: 0.9 },
};

export function ruleAppraisal(ev: RoutineEvent): Appraisal {
  return { ...NEUTRAL, ...RULES[ev] };
}

// ---------------- memory coupling and sleep consolidation ----------------
export function encodeMemoryBody(run: OrganismRun): MemoryBodySnapshot {
  const s = run.state;
  const intensity = clamp(Math.max(s.arousal, s.stress_load, s.pain, Math.abs(s.valence)), 0, 1);
  return {
    valence: s.valence,
    arousal: s.arousal,
    stress_load: s.stress_load,
    tension: s.tension,
    pain: s.pain,
    calm: s.calm,
    comfort: s.comfort,
    intensity,
  };
}

/** Recall partially reactivates the encoded body state (mood-congruent recall). */
export function reactivateMemory(
  run: OrganismRun,
  snap: MemoryBodySnapshot,
  cfg: OrganismConfig = DEFAULT_ORGANISM_CONFIG,
): OrganismRun {
  const w = cfg.memoryReactivation * snap.intensity;
  const state = { ...run.state };
  for (const k of ["valence", "arousal", "stress_load", "tension", "calm", "comfort"] as const) {
    state[k] = state[k] + (snap[k] - state[k]) * w;
  }
  // remembered pain is felt faintly, never fully
  state.pain = state.pain + Math.max(0, snap.pain - state.pain) * w * 0.3;
  return { ...run, state };
}

/** Sleep replays high-arousal memories and attenuates their intensity (emotional consolidation). */
export function consolidateMemories(
  snaps: MemoryBodySnapshot[],
  sleepHours: number,
  cfg: OrganismConfig = DEFAULT_ORGANISM_CONFIG,
): MemoryBodySnapshot[] {
  return snaps.map((m) => {
    const f = 1 - Math.min(0.6, cfg.sleepAttenuationPerHour * sleepHours * (0.5 + m.arousal));
    return {
      ...m,
      arousal: m.arousal * f,
      stress_load: m.stress_load * f,
      tension: m.tension * f,
      pain: m.pain * f,
      intensity: m.intensity * f,
    };
  });
}
