// Hidden -> Resident bridge. This is the ONLY module that reads organism/physiology numbers, and it turns them
// into (a) plain prose via the organism package's deterministic templating and (b) three numbers for the LLM
// call (temperature, max tokens, how much history) driven by cognitive fatigue (doc 10). Nothing numeric or
// named from the hidden layer is returned as prompt text.
import { describeInventory, perceive } from "@truman/world";
import { INNATE_KNOW_HOW, bodySignals, skillHints } from "@truman/body";
import {
  advanceOrganism,
  deriveSurvival,
  derivePhysiology,
  renderSensations,
  type BodySignals,
  type Physiology,
} from "@truman/organism";
import type { MindState } from "./state";

export interface Senses {
  /** Body sentences then urges, Resident-facing prose. Empty while asleep. */
  sensations: string[];
  perception: string[];
  handsKnow: string[];
  /** Hidden; kept for the Lab sample and never passed to buildPrompt. */
  physiology: Physiology;
  signals: BodySignals;
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** Relax the organism toward its body-driven targets over `minutes` (closed form, so step size does not matter). */
export function organismStep(m: MindState, minutes: number): MindState {
  if (minutes <= 0) return m;
  return { ...m, organism: advanceOrganism(m.organism, bodySignals(m.body), minutes) };
}

/** Hidden physiology vector for the Lab sample and the viewer (never prompt text). */
export function physiologyNow(m: MindState): Physiology {
  return derivePhysiology(
    m.organism.state,
    bodySignals(m.body),
    m.organism.temperament,
    m.world.t,
    m.physiology ?? undefined,
  );
}

export function senseNow(m: MindState): Senses {
  const signals = bodySignals(m.body);
  const o = m.organism.state;
  const physiology = physiologyNow(m);
  const survival = deriveSurvival(signals);
  const s = renderSensations({
    physiology,
    survival,
    organism: o,
    body: signals,
    temperament: m.organism.temperament,
    tMin: m.world.t,
  });
  // attention narrows with pain, strong stress and mental fatigue (doc 10)
  const detail = clamp(
    1 - 0.4 * o.mental_fatigue - 0.4 * Math.max(o.pain, o.stress_load > 0.5 ? o.stress_load : 0),
    0.3,
    1,
  );
  const perception = m.body.asleep ? [] : perceive(m.world, m.pos, { detail }).lines;
  return {
    sensations: [...s.sentences, ...s.urges],
    perception,
    handsKnow: [...INNATE_KNOW_HOW, ...skillHints(m.skills), describeInventory(m.inventory)],
    physiology,
    signals,
  };
}

export interface Cognition {
  temperature: number;
  maxOutputTokens: number;
  /** How many past action/outcome lines (and later, recalled memories) go into the prompt. */
  historyN: number;
}

/** Cognitive fatigue (doc 10): noisier, shorter, more impulsive decisions and less context. */
export function cognition(m: MindState): Cognition {
  const f = clamp(m.organism.state.mental_fatigue, 0, 1);
  return {
    temperature: Math.round((0.5 + 0.3 * f) * 100) / 100,
    maxOutputTokens: Math.round(1200 - 600 * f),
    historyN: f > 0.7 ? 3 : f > 0.4 ? 4 : 6,
  };
}
