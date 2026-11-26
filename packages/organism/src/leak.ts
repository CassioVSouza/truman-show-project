// Tripwire for Resident-facing text (not the guarantee: structure is). Used in tests and callable by the worker.
import { EMOTION_ATLAS } from "./atlas";

const HIDDEN_NAMES = [
  "valence",
  "arousal",
  "reward",
  "stress",
  "bonding",
  "vigilance",
  "calm",
  "comfort",
  "stability",
  "hunger",
  "expression",
  "deprivation",
  "fatigue",
  "restlessness",
  "coherence",
  "tension",
  "satiety",
  "hydration",
  "stamina",
  "health",
  "energy",
  "drive",
  "appraisal",
  "organism",
  "physiology",
  "temperament",
  "immune",
  "level",
  "bar",
  "score",
  "percent",
  "need",
  "needs",
  "meter",
  "value",
  "variable",
  "simulation",
  "model",
  "prompt",
  "program",
  "game",
];
const NUMBER_WORDS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "hundred",
];
const EMOTION_EXTRA = [
  "afraid",
  "scared",
  "frightened",
  "happy",
  "sad",
  "angry",
  "furious",
  "anxious",
  "worried",
  "excited",
  "lonely",
  "depressed",
  "ashamed",
  "proud",
  "jealous",
  "grateful",
  "emotion",
  "emotions",
  "feeling",
  "mood",
  "hungry",
  "thirsty",
  "tired",
  "sleepy",
  "exhausted",
  "love",
  "joyful",
];

const STOP = new Set(["for", "of", "the", "to", "in"]);

/** Returns the banned tokens found in `text` (empty array = clean). */
export function findLeaks(text: string): string[] {
  const hits: string[] = [];
  if (/\d/.test(text)) hits.push("digit");
  const words = text.toLowerCase().match(/[a-z][a-z-]*/g) ?? [];
  const atlas = new Set(
    Object.keys(EMOTION_ATLAS)
      .flatMap((l) => l.split("-"))
      .filter((w) => !STOP.has(w)),
  );
  const banned = new Set([...HIDDEN_NAMES, ...NUMBER_WORDS, ...EMOTION_EXTRA, ...atlas]);
  for (const w of words) if (banned.has(w) && !hits.includes(w)) hits.push(w);
  return hits;
}
