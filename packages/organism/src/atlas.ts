// Emotion atlas: SPECTATORS / LAB ONLY. Never import this from sensation.ts or any Resident-facing path.
import type { OrganismKey, OrganismState } from "./types";

type Proto = Partial<Record<OrganismKey, number>>;

/** 50+ prototypes in organism-state space (valence -1..1, others 0..1). Approximate labels for watching and tuning. */
export const EMOTION_ATLAS: Record<string, Proto> = {
  joy: { valence: 0.9, arousal: 0.7, reward_anticipation: 0.6, comfort: 0.8, stress_load: 0.05 },
  amusement: { valence: 0.7, arousal: 0.6, tension: 0.1, stress_load: 0.05 },
  contentment: { valence: 0.6, arousal: 0.2, calm: 0.8, comfort: 0.8, stability: 0.8 },
  serenity: { valence: 0.5, arousal: 0.1, calm: 0.95, comfort: 0.85, stress_load: 0 },
  relief: { valence: 0.6, arousal: 0.3, stress_load: 0.2, calm: 0.7, tension: 0.1 },
  excitement: { valence: 0.8, arousal: 0.9, reward_anticipation: 0.8, restlessness: 0.5 },
  anticipation: { valence: 0.4, arousal: 0.6, reward_anticipation: 0.8, vigilance: 0.4 },
  hope: { valence: 0.5, arousal: 0.4, reward_anticipation: 0.7, stress_load: 0.3 },
  pride: { valence: 0.8, arousal: 0.5, stability: 0.9, comfort: 0.7 },
  triumph: { valence: 0.9, arousal: 0.85, stability: 0.8, reward_anticipation: 0.5 },
  gratitude: { valence: 0.8, arousal: 0.3, bonding: 0.8, calm: 0.6 },
  admiration: { valence: 0.7, arousal: 0.5, bonding: 0.5, reward_anticipation: 0.5 },
  awe: {
    valence: 0.6,
    arousal: 0.6,
    coherence_need: 0.5,
    vigilance: 0.4,
    expression_pressure: 0.6,
  },
  wonder: { valence: 0.6, arousal: 0.55, info_hunger: 0.7, coherence_need: 0.5 },
  interest: { valence: 0.4, arousal: 0.45, info_hunger: 0.8, restlessness: 0.2 },
  flow: { valence: 0.6, arousal: 0.5, mental_fatigue: 0.1, restlessness: 0, stability: 0.8 },
  nostalgia: { valence: 0.2, arousal: 0.3, bonding: 0.6, social_deprivation: 0.5, calm: 0.5 },
  longing: { valence: -0.1, arousal: 0.4, social_deprivation: 0.8, reward_anticipation: 0.5 },
  attachment: { valence: 0.7, arousal: 0.3, bonding: 0.95, calm: 0.7, social_deprivation: 0 },
  tenderness: { valence: 0.7, arousal: 0.2, bonding: 0.8, calm: 0.8 },
  compassion: { valence: 0.1, arousal: 0.4, bonding: 0.7, stress_load: 0.3 },
  trust: { valence: 0.5, arousal: 0.2, bonding: 0.7, vigilance: 0.05, calm: 0.7 },
  awkwardness: { valence: -0.2, arousal: 0.5, tension: 0.6, stability: 0.3 },
  surprise: { valence: 0.1, arousal: 0.85, vigilance: 0.7, coherence_need: 0.4 },
  confusion: { valence: -0.2, arousal: 0.4, coherence_need: 0.85, stability: 0.3 },
  doubt: { valence: -0.2, arousal: 0.3, coherence_need: 0.65, stability: 0.35 },
  boredom: {
    valence: -0.2,
    arousal: 0.1,
    restlessness: 0.85,
    info_hunger: 0.7,
    reward_anticipation: 0.05,
  },
  restlessness: { valence: -0.1, arousal: 0.5, restlessness: 0.95, tension: 0.4 },
  apathy: { valence: -0.3, arousal: 0.05, reward_anticipation: 0, restlessness: 0.1, comfort: 0.4 },
  loneliness: { valence: -0.4, arousal: 0.25, social_deprivation: 0.95, bonding: 0.1 },
  sadness: { valence: -0.7, arousal: 0.2, stress_load: 0.4, reward_anticipation: 0.05 },
  grief: { valence: -0.9, arousal: 0.3, stress_load: 0.7, bonding: 0.7, stability: 0.1 },
  disappointment: { valence: -0.5, arousal: 0.3, reward_anticipation: 0.1, stress_load: 0.3 },
  regret: { valence: -0.6, arousal: 0.3, stability: 0.3, coherence_need: 0.5 },
  shame: { valence: -0.8, arousal: 0.5, stability: 0.05, tension: 0.7, vigilance: 0.5 },
  guilt: { valence: -0.7, arousal: 0.45, stability: 0.2, stress_load: 0.5, tension: 0.5 },
  embarrassment: { valence: -0.5, arousal: 0.65, tension: 0.6, stability: 0.3 },
  envy: { valence: -0.5, arousal: 0.5, reward_anticipation: 0.4, stress_load: 0.4 },
  jealousy: { valence: -0.6, arousal: 0.6, bonding: 0.6, vigilance: 0.6, stress_load: 0.5 },
  irritation: { valence: -0.4, arousal: 0.55, tension: 0.6, stress_load: 0.35 },
  anger: { valence: -0.7, arousal: 0.8, tension: 0.8, stress_load: 0.6, vigilance: 0.6 },
  rage: { valence: -0.9, arousal: 1, tension: 0.95, stress_load: 0.8, vigilance: 0.8 },
  contempt: { valence: -0.5, arousal: 0.35, calm: 0.5, tension: 0.4, bonding: 0 },
  disgust: { valence: -0.7, arousal: 0.5, tension: 0.5, comfort: 0.1 },
  fear: { valence: -0.7, arousal: 0.85, vigilance: 0.9, stress_load: 0.7, calm: 0.05 },
  anxiety: {
    valence: -0.5,
    arousal: 0.65,
    vigilance: 0.7,
    stress_load: 0.6,
    tension: 0.7,
    calm: 0.15,
  },
  dread: { valence: -0.8, arousal: 0.6, vigilance: 0.85, stress_load: 0.8, stability: 0.1 },
  panic: { valence: -0.9, arousal: 1, vigilance: 1, stress_load: 0.9, calm: 0 },
  despair: { valence: -1, arousal: 0.2, stress_load: 0.9, reward_anticipation: 0, stability: 0.05 },
  melancholy: { valence: -0.4, arousal: 0.15, calm: 0.5, stress_load: 0.25 },
  craving: {
    valence: 0.1,
    arousal: 0.6,
    reward_anticipation: 0.85,
    comfort: 0.3,
    restlessness: 0.5,
  },
  "hunger-for-knowledge": { valence: 0.3, arousal: 0.5, info_hunger: 0.95, restlessness: 0.4 },
  "vertigo-of-the-unknown": {
    valence: -0.1,
    arousal: 0.7,
    coherence_need: 0.8,
    stability: 0.2,
    vigilance: 0.5,
  },
  "existential-unease": {
    valence: -0.4,
    arousal: 0.35,
    coherence_need: 0.75,
    stability: 0.15,
    social_deprivation: 0.6,
  },
  exhaustion: { valence: -0.3, arousal: 0.05, mental_fatigue: 0.9, rest_need: 0.9 },
  suffering: { valence: -0.8, arousal: 0.7, pain: 0.9, stress_load: 0.7 },
  discomfort: { valence: -0.4, arousal: 0.4, comfort: 0.1, pain: 0.2 },
};

const FEATURES: OrganismKey[] = [
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
];

export interface EmotionLabel {
  label: string;
  weight: number;
}

/** Top-3 weighted approximate labels (weights sum to 1). Spectators/Lab only. */
export function emotionLabels(s: OrganismState, topN = 3): EmotionLabel[] {
  const scored = Object.entries(EMOTION_ATLAS).map(([label, proto]) => {
    let sum = 0;
    let n = 0;
    for (const k of FEATURES) {
      const target = proto[k];
      if (target === undefined) continue;
      const scale = k === "valence" ? 0.5 : 1; // valence spans 2 units
      sum += ((s[k] - target) * scale) ** 2;
      n += 1;
    }
    const dist = Math.sqrt(sum / Math.max(1, n));
    return { label, sim: Math.exp(-dist * 5) };
  });
  scored.sort((a, b) => b.sim - a.sim || a.label.localeCompare(b.label));
  const top = scored.slice(0, topN);
  const total = top.reduce((a, b) => a + b.sim, 0) || 1;
  return top.map((x) => ({ label: x.label, weight: x.sim / total }));
}
