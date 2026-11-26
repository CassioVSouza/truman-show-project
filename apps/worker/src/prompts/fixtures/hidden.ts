// Rich FAKE hidden state and FAKE secrets for the leak test. All values are invented.
import { Appraisal, BodyState, OrganismState, Physiology } from "@truman/contracts";

export const FAKE_SECRETS = {
  SUPABASE_SERVICE_KEY: "test-key-not-real-supabase-service",
  GEMINI_API_KEY: "test-key-not-real-gemini",
  GROQ_API_KEY: "test-key-not-real-groq",
  TAVILY_API_KEY: "test-key-not-real-tavily",
  ADMIN_TOKEN: "test-token-not-real-admin",
};

export const FAKE_ORGANISM = {
  valence: -0.42,
  arousal: 0.77,
  reward_anticipation: 0.31,
  stress_load: 0.66,
  bonding: 0.12,
  vigilance: 0.58,
  calm: 0.2,
  comfort: 0.35,
  stability: 0.61,
  info_hunger: 0.93,
  expression_pressure: 0.48,
  social_deprivation: 0.84,
  mental_fatigue: 0.57,
  rest_need: 0.71,
  restlessness: 0.39,
  coherence_need: 0.44,
  pain: 0.26,
  tension: 0.52,
};
export const FAKE_BODY = { health: 87, satiety: 41, hydration: 63, core_temp: 36.4, stamina: 55 };
export const FAKE_PHYSIOLOGY = {
  heart_rate: 94,
  breath_rate: 19,
  muscle_tension: 0.62,
  gut_knot: 0.73,
};
export const FAKE_APPRAISAL = { novelty: 0.9, threat: 0.35, predictedness: 0.14 };
export const FAKE_EMOTION_TOP3 = [
  { label: "anxiety", weight: 0.6 },
  { label: "hunger-for-knowledge", weight: 0.3 },
  { label: "existential unease", weight: 0.1 },
];

/** Every hidden key name from the real contracts. The scanner treats these as forbidden terms. */
export function hiddenKeyNames(): string[] {
  return [
    ...Object.keys(OrganismState.shape),
    ...Object.keys(Physiology.shape),
    ...Object.keys(Appraisal.shape),
    ...Object.keys(BodyState.shape),
    "appraisal",
    "temperament",
    "organism",
    "physiology",
    "vitals",
    "emotion_label",
    "prediction_error",
  ];
}

/** Distinctive hidden numbers formatted as they might be pasted by mistake. */
export function hiddenValueStrings(): string[] {
  return ["0.93", "0.84", "0.77", "-0.42", "36.4", "0.73"];
}
