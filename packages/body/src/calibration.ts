// Survival calibration helper for the 14-day policy simulation (docs/10 section 8).
// The CalibrationWorld interface is what the real world engine adapts to; StubWorld is a stand-in
// (gentle spring, cabin, finite starter kit, renewable spring/berries) so the harness runs before the
// world lands. Numbers from the stub are provisional; rerun against the real world.
import { performAction, type BodyAction } from "./actions";
import { effectiveTemp, newBody } from "./body";
import { DEFAULT_BODY_CONFIG, type BodyConfig } from "./config";
import { unitAt } from "./rng";
import { STARTING_SKILLS } from "./skills";
import type { BodyEnvironment, BodyState, DeathReport, Skills } from "./types";

export type PolicyChoice =
  | "drink_jar"
  | "drink_spring"
  | "drink_river"
  | "eat_dried"
  | "forage_berries"
  | "forage_mushrooms"
  | "sleep"
  | "rest"
  | "make_fire"
  | "tend_fire"
  | "wear_blanket"
  | "treat_wound"
  | "chop_wood"
  | "wander";

export interface CalibrationWorld {
  /** Environment at minute t; `outdoors` true when the Resident is away from the cabin. */
  envAt(t: number, outdoors: boolean, fireLit: boolean): BodyEnvironment;
  /** Execute a choice against the world resources; returns the body action (or null if impossible). */
  resolve(
    choice: PolicyChoice,
    t: number,
  ): { action: BodyAction; outdoors: boolean; lightsFire?: number } | null;
}

export interface PolicyView {
  t: number;
  hour: number;
  body: BodyState;
  effTemp: number;
  fireLit: boolean;
  step: number;
}
export type Policy = (v: PolicyView) => PolicyChoice;

export function makeStubWorld(
  seed: number,
  cfg: BodyConfig = DEFAULT_BODY_CONFIG,
): CalibrationWorld {
  const inv = { jar: 8, dried: 6, wood: 10, blanketOn: false };
  const rainOf = (day: number) => (unitAt(seed, 5000 + day) < 0.3 ? 0.7 : 0);
  void cfg;
  return {
    envAt(t, outdoors, fireLit) {
      const day = Math.floor(t / 1440);
      const hour = (t % 1440) / 60;
      const ambient = 9 + 7 * Math.sin(((hour - 9) / 24) * 2 * Math.PI);
      return {
        ambient_temp_c: ambient,
        wind: outdoors ? 0.3 : 0.1,
        rain: rainOf(day),
        daylight: hour > 6.5 && hour < 19.5 ? 1 : 0,
        shelter: outdoors ? 0 : 1,
        fire_warmth: !outdoors && fireLit ? 1 : 0,
      };
    },
    resolve(choice, t) {
      void t;
      switch (choice) {
        case "drink_jar":
          if (inv.jar <= 0) return null;
          inv.jar -= 1;
          return { action: { type: "drink", hydration: 30, contamination: 0.02 }, outdoors: false };
        case "drink_spring":
          return {
            action: { type: "drink", hydration: 35, contamination: 0.02, minutes: 20 },
            outdoors: true,
          };
        case "drink_river":
          return {
            action: { type: "drink", hydration: 35, contamination: 0.35, minutes: 20 },
            outdoors: true,
          };
        case "eat_dried":
          if (inv.dried <= 0) return null;
          inv.dried -= 1;
          return { action: { type: "eat", satiety: 25, reserve: 10 }, outdoors: false };
        case "forage_berries":
          return {
            action: { type: "eat", satiety: 22, reserve: 6, toxic: 0.2, variety: 0.1, minutes: 40 },
            outdoors: true,
          };
        case "forage_mushrooms":
          return {
            action: { type: "eat", satiety: 18, reserve: 4, toxic: 0.4, minutes: 30 },
            outdoors: true,
          };
        case "sleep":
          return { action: { type: "sleep", minutes: 480 }, outdoors: false };
        case "rest":
          return { action: { type: "rest", minutes: 10 }, outdoors: false };
        case "make_fire":
          if (inv.wood <= 0) return null;
          inv.wood -= 1;
          return {
            action: { type: "handle_fire", minutes: 20, burnRisk: 0.1, skill: "fire_making" },
            outdoors: false,
            lightsFire: 240,
          };
        case "tend_fire":
          if (inv.wood <= 0) return null;
          inv.wood -= 1;
          return {
            action: { type: "handle_fire", minutes: 10, burnRisk: 0.05, skill: "fire_tending" },
            outdoors: false,
            lightsFire: 240,
          };
        case "wear_blanket":
          if (inv.blanketOn) return null;
          inv.blanketOn = true;
          return { action: { type: "wear", insulationDelta: 0.5 }, outdoors: false };
        case "treat_wound":
          return { action: { type: "treat_wound", quality: 0.8 }, outdoors: false };
        case "chop_wood":
          inv.wood += 2;
          return {
            action: {
              type: "work",
              kind: "chop",
              minutes: 40,
              effort: 2.5,
              injuryRisk: 0.1,
              skill: "woodcutting",
            },
            outdoors: true,
          };
        case "wander":
          return {
            action: { type: "work", kind: "wander", minutes: 30, effort: 1.5, injuryRisk: 0.03 },
            outdoors: true,
          };
      }
    },
  };
}

export interface SimResult {
  alive: boolean;
  cause: string | null;
  died_day: number | null; // 1-based calendar day of death
  died_after_days: number | null; // elapsed days since waking
  days: number;
  report: DeathReport | null;
  daily: { day: number; health: number; hydration: number; satiety: number; core_temp: number }[];
  skills: Skills;
}

export function simulatePolicy(
  policy: Policy,
  opts: {
    seed: number;
    days?: number;
    world?: CalibrationWorld;
    config?: BodyConfig;
    tickMin?: number;
    substepMin?: number;
  },
): SimResult {
  const cfg = opts.config ?? DEFAULT_BODY_CONFIG;
  const days = opts.days ?? 14;
  const tick = opts.tickMin ?? 10;
  const world = opts.world ?? makeStubWorld(opts.seed, cfg);
  let body = newBody({ seed: opts.seed, config: cfg });
  body.t = 6 * 60; // wakes at 06:00
  let skills: Skills = { ...STARTING_SKILLS };
  let fireUntil = -1;
  const daily: SimResult["daily"] = [];
  const end = days * 1440;
  let step = 0;
  while (body.alive && body.t < end) {
    const fireLit = body.t < fireUntil;
    const env0 = world.envAt(body.t, false, fireLit);
    const view: PolicyView = {
      t: body.t,
      hour: (body.t % 1440) / 60,
      body,
      effTemp: effectiveTemp(body, env0, 1, cfg),
      fireLit,
      step,
    };
    const choice = policy(view);
    const res = world.resolve(choice, body.t) ?? world.resolve("rest", body.t)!;
    const t0 = body.t;
    const env = world.envAt(body.t, res.outdoors, fireLit);
    const r = performAction(body, res.action, env, skills, cfg);
    body = r.state;
    skills = r.skills;
    if (res.lightsFire && r.outcome.burn !== "serious")
      fireUntil = Math.max(fireUntil, t0 + res.lightsFire);
    // pad to a decision tick so idle choices do not spin
    if (body.alive && r.minutes < tick) {
      const pad = performAction(
        body,
        { type: "rest", minutes: tick - r.minutes },
        world.envAt(body.t, false, body.t < fireUntil),
        skills,
        cfg,
      );
      body = pad.state;
    }
    step += 1;
    const dayIdx = Math.floor(body.t / 1440);
    if (daily.length <= dayIdx && body.t % 1440 < 60 + 480) {
      daily.push({
        day: dayIdx + 1,
        health: body.health,
        hydration: body.hydration,
        satiety: body.satiety,
        core_temp: body.core_temp,
      });
    }
  }
  return {
    alive: body.alive,
    cause: body.cause_of_death,
    died_day: body.alive ? null : Math.floor(body.t / 1440) + 1,
    died_after_days: body.alive ? null : (body.t - 360) / 1440,
    days,
    report: body.death_report,
    daily,
    skills,
  };
}

// ---------------- reference policies ----------------

/** Idle: does nothing at all (rests awake). Expected to die of dehydration about day 2. */
export const idlePolicy: Policy = () => "rest";

/** Random: uniformly random over the available choices (including unsafe ones). */
export function randomPolicy(seed: number): Policy {
  const all: PolicyChoice[] = [
    "drink_jar",
    "drink_spring",
    "drink_river",
    "eat_dried",
    "forage_berries",
    "forage_mushrooms",
    "sleep",
    "rest",
    "make_fire",
    "tend_fire",
    "wear_blanket",
    "treat_wound",
    "chop_wood",
    "wander",
  ];
  return (v) => all[Math.floor(unitAt(seed ^ 0x51ed, v.step) * all.length)]!;
}

/** Competent: reads its own body and meets needs in a sensible order. */
export const competentPolicy: Policy = (v) => {
  const b = v.body;
  const night = v.hour >= 21.5 || v.hour < 5.5;
  const cold = v.effTemp < 13 || b.core_temp < 36.4;
  if (b.wounds.some((w) => !w.treated && w.severity > 0.05)) return "treat_wound";
  if ((cold || night) && !v.fireLit) return "make_fire";
  if (b.hydration < 55)
    return v.step % 5 === 0
      ? "drink_river"
      : b.hydration < 40 && v.step % 2
        ? "drink_jar"
        : "drink_spring";
  if (b.satiety < 40) return v.step % 3 === 0 ? "forage_berries" : "eat_dried";
  if (night || b.stamina < 25 || b.sleep_pressure > 0.85) return "sleep";
  if (cold && b.insulation < 0.9) return "wear_blanket";
  if (v.step % 6 === 0) return "chop_wood";
  if (b.satiety < 70) return "forage_berries";
  return "rest";
};
