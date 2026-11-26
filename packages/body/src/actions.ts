// Survival action effects on the body. The world decides what exists (items, fires, water); this module
// decides what it does to the body, using seeded draws stored in the body state (deterministic).
import { addCondition, addWound, advanceBody, wakeReason } from "./body";
import { DEFAULT_BODY_CONFIG, type BodyConfig } from "./config";
import { draw, drawRange, pick } from "./rng";
import { practice } from "./skills";
import type { BodyEnvironment, BodyState, ReflexEvent, Skills, WakeRequest } from "./types";

export type BodyAction =
  | {
      type: "eat";
      satiety: number;
      reserve: number;
      hydration?: number;
      /** Total illness chance, already including any spoilage (world facts.toxic). Applied exactly once. */
      toxic?: number;
      variety?: number;
      minutes?: number;
    }
  | { type: "drink"; hydration: number; contamination?: number; boiled?: boolean; minutes?: number }
  | { type: "rest"; minutes: number }
  | { type: "sleep"; minutes: number }
  | {
      type: "work";
      kind: string;
      minutes: number;
      effort?: number;
      injuryRisk?: number;
      skill?: string;
    }
  | {
      type: "handle_fire";
      minutes?: number;
      burnRisk?: number;
      skill?: "fire_making" | "fire_tending";
    }
  | { type: "treat_wound"; woundId?: number; quality?: number; minutes?: number }
  | { type: "wear"; insulationDelta: number };

export interface ActionResult {
  state: BodyState;
  skills: Skills;
  events: ReflexEvent[];
  wake: WakeRequest[];
  minutes: number; // minutes actually elapsed
  interrupted: string | null; // reason a sleep/rest ended early
  outcome: Record<string, number | string | boolean>; // structured facts for the caller / log
}

const HAND_PLACES = [
  "left hand",
  "right hand",
  "left forearm",
  "right forearm",
  "left thumb",
  "right palm",
] as const;

export function performAction(
  state: BodyState,
  action: BodyAction,
  env: BodyEnvironment,
  skills: Skills,
  cfg: BodyConfig = DEFAULT_BODY_CONFIG,
): ActionResult {
  let s = structuredClone(state);
  let sk = skills;
  const events: ReflexEvent[] = [];
  const wake: WakeRequest[] = [];
  const outcome: ActionResult["outcome"] = {};
  let minutes = 0;
  let interrupted: string | null = null;
  const run = (
    mins: number,
    effort: number,
    asleep = false,
    stopWhen?: (b: BodyState) => boolean,
  ) => {
    const r = advanceBody(s, env, { asleep, effort }, mins, cfg, { stopWhen });
    minutes += r.state.t - s.t;
    s = r.state;
    events.push(...r.events);
    wake.push(...r.wake);
  };
  const skill = (name: string) => (sk[name] ?? 0) / 100;
  if (!s.alive)
    return { state: s, skills: sk, events, wake, minutes: 0, interrupted: "dead", outcome };

  switch (action.type) {
    case "eat": {
      const gain = action.satiety;
      const over = Math.max(0, s.satiety + gain - 100);
      s.satiety = Math.min(100, s.satiety + gain);
      s.energy_reserve = Math.min(100, s.energy_reserve + action.reserve + over * 0.5);
      s.hydration = Math.min(100, s.hydration + (action.hydration ?? 0));
      s.nutrient_balance = Math.min(1, s.nutrient_balance + (action.variety ?? 0.05));
      const toxicP = (action.toxic ?? 0) * (1 - 0.6 * skill("foraging"));
      if (draw(s) < toxicP) {
        addCondition(s, "food_poisoning", drawRange(s, 0.55, 0.85), 60, "toxin", events);
        outcome.sickened = "toxin";
      }
      sk = practice(sk, "foraging", 0.3, outcome.sickened ? 0.2 : 1);
      run(action.minutes ?? 10, 1);
      break;
    }
    case "drink": {
      s.hydration = Math.min(100, s.hydration + action.hydration);
      const base = action.contamination ?? 0;
      const p =
        base *
        (action.boiled ? 0.05 : 1) *
        (1 - 0.3 * s.immune) *
        (1 - 0.3 * skill("drinking_water_safety"));
      if (draw(s) < p) {
        addCondition(s, "food_poisoning", drawRange(s, 0.3, 0.6), 360, "pathogen", events);
        outcome.sickened = "water";
      }
      sk = practice(sk, "drinking_water_safety", 0.3, outcome.sickened ? 0.2 : 1);
      run(action.minutes ?? 3, 1);
      break;
    }
    case "rest":
      run(action.minutes, 0);
      break;
    case "sleep": {
      const stop = (b: BodyState) =>
        wakeReason(b, cfg) !== null || (b.sleep_pressure < 0.04 && b.stamina >= 99);
      run(action.minutes, 0, true, stop);
      interrupted = minutes < action.minutes - 1e-6 ? (wakeReason(s, cfg) ?? "rested") : null;
      break;
    }
    case "work": {
      const effort = action.effort ?? 2;
      const name = action.skill;
      const risk = (action.injuryRisk ?? 0) * (1 - 0.5 * (name ? skill(name) : 0));
      const pAny = 1 - Math.pow(1 - Math.min(0.99, risk), action.minutes / 30);
      run(action.minutes, effort);
      if (s.alive && draw(s) < pAny) {
        const w = addWound(
          s,
          { type: "cut", location: pick(s, HAND_PLACES), severity: drawRange(s, 0.12, 0.45) },
          cfg,
          events,
          wake,
        );
        outcome.injury = w.type;
        pushFlinch(s, events);
      }
      if (name) sk = practice(sk, name, action.minutes / 30, outcome.injury ? 0.5 : 1);
      break;
    }
    case "handle_fire": {
      const p = (action.burnRisk ?? 0.08) * (1 - 0.5 * skill(action.skill ?? "fire_tending"));
      if (draw(s) < p) {
        const reflexOk = draw(s) < 0.5 + 0.4 * skill(action.skill ?? "fire_tending");
        events.push({
          t: s.t,
          kind: "withdraw_from_fire",
          detail: reflexOk
            ? "hand withdrew from fire (reflex), minor burn"
            : "reflex too slow, burn",
          data: { ok: reflexOk },
        });
        s.timeline.push(events[events.length - 1]!);
        addWound(
          s,
          {
            type: "burn",
            location: pick(s, HAND_PLACES),
            severity: reflexOk ? 0.08 : drawRange(s, 0.35, 0.6),
          },
          cfg,
          events,
          wake,
        );
        outcome.burn = reflexOk ? "minor" : "serious";
      }
      sk = practice(sk, action.skill ?? "fire_tending", 0.5, outcome.burn ? 0.5 : 1);
      run(action.minutes ?? 15, 1.5);
      break;
    }
    case "treat_wound": {
      const target =
        s.wounds.find((w) => w.id === action.woundId) ??
        [...s.wounds].filter((w) => !w.treated).sort((a, b) => b.severity - a.severity)[0];
      const q = Math.max(
        0,
        Math.min(1, (action.quality ?? 0.7) * (0.4 + 0.6 * skill("first_aid"))),
      );
      if (target) {
        const ok = draw(s) < q + 0.15;
        if (ok) {
          target.treated = true;
          target.infect_at = null;
          if (target.infected && draw(s) < 0.7) target.infected = false;
        }
        outcome.treated = ok;
        sk = practice(sk, "first_aid", 1, ok ? 1 : 0.4);
      } else outcome.treated = false;
      run(action.minutes ?? 15, 1);
      break;
    }
    case "wear":
      s.insulation = Math.max(0, Math.min(1.8, s.insulation + action.insulationDelta));
      sk = practice(sk, "shelter_warmth", 0.2, 1);
      run(5, 1);
      break;
  }
  return { state: s, skills: sk, events, wake, minutes, interrupted, outcome };
}

function pushFlinch(s: BodyState, events: ReflexEvent[]): void {
  const e: ReflexEvent = { t: s.t, kind: "flinch", detail: "flinched at sudden pain (reflex)" };
  events.push(e);
  s.timeline.push(e);
}
