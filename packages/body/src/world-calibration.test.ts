// 14-day policy simulation against the REAL world engine (@truman/world). Drives world actions, maps their
// structured `facts` onto body actions, and steps the body under the world's environment.
import {
  advance,
  advanceInventory,
  boilWater,
  createWorld,
  drink,
  eat,
  environmentAt,
  fillJar,
  findItem,
  gather,
  invCount,
  makeFire,
  mapOf,
  moveTo,
  starterInventory,
  tendFire,
  wear,
  type ActionResult,
  type Actor,
  type WorldState,
} from "@truman/world";
import type { Environment, Station } from "@truman/contracts";
import { describe, expect, test } from "vitest";
import { performAction, type BodyAction } from "./actions";
import { bodyEnvironmentFromWorld, newBody } from "./body";
import { unitAt } from "./rng";
import { STARTING_SKILLS } from "./skills";
import type { BodyState, DeathCause } from "./types";

type Choice =
  | "drink_jar"
  | "drink_spring"
  | "drink_river"
  | "refill_jar"
  | "boil"
  | "eat_dried"
  | "eat_fruit"
  | "eat_roots"
  | "eat_berries"
  | "eat_mushrooms"
  | "forage_berries"
  | "forage_fruit"
  | "forage_roots"
  | "forage_mushrooms"
  | "chop"
  | "make_fire"
  | "tend_fire"
  | "wear_blanket"
  | "sleep"
  | "rest"
  | "wander"
  | "treat_wound"
  | "go_cabin";

interface View {
  t: number;
  hour: number;
  step: number;
  body: BodyState;
  env: Environment;
  wood: number;
  food: Record<string, number>;
  jarFill: number;
  jarQuality: string;
  inCabin: boolean;
  blanketWorn: boolean;
  fireNear: boolean;
}
type Policy = (v: View) => Choice;

interface Out {
  chain: string[];
  alive: boolean;
  cause: DeathCause | null;
  afterDays: number | null;
  day: number | null;
}

const ACT = (effort: number, minutes: number, kind = "walk"): BodyAction => ({
  type: "work",
  kind,
  minutes,
  effort,
});

function run(policy: Policy, seed: number, days = 14): Out {
  let w: WorldState = createWorld(seed);
  const map = mapOf(w);
  let a: Actor = {
    pos: { ...map.stations.bed },
    inventory: starterInventory(),
    skills: { ...STARTING_SKILLS },
  };
  let b = newBody({ seed });
  const end = days * 1440;
  let step = 0;
  const stations: Station[] = ["forest_edge", "clearing", "river"];
  while (b.alive && w.t < end) {
    const env0 = environmentAt(w, a.pos);
    const jar = findItem(a.inventory, "water jar");
    const jp = (jar?.props ?? {}) as { fill?: number; quality?: string };
    const blanket = findItem(a.inventory, "wool blanket");
    const view: View = {
      t: w.t,
      hour: (w.t % 1440) / 60,
      step,
      body: b,
      env: env0,
      wood: invCount(a.inventory, "firewood"),
      food: {
        dried: invCount(a.inventory, "dried food"),
        fruit: invCount(a.inventory, "fruit"),
        roots: invCount(a.inventory, "roots"),
        berries: invCount(a.inventory, "berries"),
      },
      jarFill: Number(jp.fill ?? 0),
      jarQuality: String(jp.quality ?? "clean"),
      inCabin: env0.shelter === "cabin",
      blanketWorn: !!(blanket?.props as { worn?: boolean } | undefined)?.worn,
      fireNear: env0.fire_heat_c > 1,
    };
    const choice = policy(view);
    let r: ActionResult | null = null;
    let body: BodyAction | null = null;
    const goTo = (s: Station | "spring") => {
      const m = moveTo(w, a, s);
      w = m.world;
      a = m.actor;
      return m;
    };
    const cabinSpot = (): void => {
      if (environmentAt(w, a.pos).shelter !== "cabin") goTo("bed");
    };
    switch (choice) {
      case "drink_jar":
        cabinSpot();
        r = drink(w, a, "jar");
        break;
      case "drink_spring":
        goTo("spring");
        r = drink(w, a, "spring");
        break;
      case "drink_river":
        goTo("river");
        r = drink(w, a, "river");
        break;
      case "refill_jar":
        goTo("spring");
        r = fillJar(w, a, "spring");
        break;
      case "boil":
        cabinSpot();
        r = boilWater(w, a);
        break;
      case "eat_dried":
        r = eat(w, a, "dried food");
        break;
      case "eat_fruit":
        r = eat(w, a, "fruit");
        break;
      case "eat_roots":
        r = eat(w, a, "roots");
        break;
      case "eat_berries":
        r = eat(w, a, "berries");
        break;
      case "eat_mushrooms":
        r = eat(w, a, "mushrooms");
        break;
      case "forage_berries":
      case "forage_fruit":
      case "forage_roots":
      case "forage_mushrooms": {
        const target = choice.slice(7);
        const st = stations[step % stations.length]!;
        goTo(st);
        r = gather(w, a, target);
        break;
      }
      case "chop": {
        goTo("forest_edge");
        r = gather(w, a, "wood");
        break;
      }
      case "make_fire":
        cabinSpot();
        r = makeFire(w, a);
        break;
      case "tend_fire":
        cabinSpot();
        r = tendFire(w, a);
        break;
      case "wear_blanket":
        r = wear(w, a, "wool blanket");
        break;
      case "go_cabin":
        goTo("bed");
        r = null;
        break;
      case "wander": {
        const m = goTo(stations[Math.floor(unitAt(seed, step + 77) * stations.length)]!);
        r = m;
        break;
      }
      case "treat_wound":
        body = { type: "treat_wound", quality: 0.8 };
        break;
      case "sleep":
        cabinSpot();
        body = { type: "sleep", minutes: 480 };
        break;
      case "rest":
        body = { type: "rest", minutes: 10 };
        break;
    }
    const t0 = w.t;
    if (r) {
      if (r.ok) {
        w = r.world;
        a = r.actor;
      }
      const f = r.facts;
      const mins = Math.max(1, r.minutes);
      if (!r.ok) body = { type: "rest", minutes: mins };
      else if (choice.startsWith("drink"))
        body = {
          type: "drink",
          hydration: Number(f.hydration ?? 0),
          contamination: Number(f.contamination ?? 0),
          boiled: !!f.boiled,
          minutes: mins,
        };
      else if (choice.startsWith("eat"))
        body = {
          type: "eat",
          satiety: Number(f.satiety ?? 0),
          reserve: Number(f.reserve ?? 0),
          hydration: Number(f.hydration ?? 0),
          toxic: Number(f.toxic ?? 0),
          minutes: mins,
        };
      else if (choice === "make_fire" || choice === "tend_fire" || choice === "boil")
        body = {
          type: "handle_fire",
          minutes: mins,
          burnRisk: Number(f.burn_risk ?? 0.08),
          skill: choice === "make_fire" ? "fire_making" : "fire_tending",
        };
      else if (choice === "wear_blanket")
        body = { type: "wear", insulationDelta: Number(f.insulationDelta ?? 0) };
      else if (choice === "refill_jar") body = ACT(1.2, mins, "fetch");
      else if (choice.startsWith("forage") || choice === "chop")
        body = {
          type: "work",
          kind: choice,
          minutes: mins,
          effort: choice === "chop" ? 2.5 : 1.8,
          injuryRisk: choice === "chop" ? 0.12 : 0.04,
          skill: typeof f.skill === "string" ? f.skill : undefined,
        };
      else body = ACT(1.5, mins);
    }
    if (!body) body = { type: "rest", minutes: 5 };
    // world time covers the whole macro-action (including any walking done above)
    const env = environmentAt(w, a.pos);
    const res = performAction(b, body, bodyEnvironmentFromWorld(env), a.skills);
    b = res.state;
    a = { ...a, skills: res.skills };
    const bodyT = b.t;
    const target = Math.max(bodyT, w.t);
    const from = w.t;
    w = advance(w, target);
    a = { ...a, inventory: advanceInventory(a.inventory, w, from, target) };
    // keep clocks locked: body time follows world time
    if (b.alive && b.t < w.t) {
      const pad = performAction(
        b,
        { type: "rest", minutes: w.t - b.t },
        bodyEnvironmentFromWorld(environmentAt(w, a.pos)),
        a.skills,
      );
      b = pad.state;
    }
    void t0;
    step += 1;
  }
  return {
    chain: b.death_report?.chain ?? [],
    alive: b.alive,
    cause: b.cause_of_death,
    afterDays: b.alive ? null : b.t / 1440,
    day: b.alive ? null : Math.floor(b.t / 1440) + 1,
  };
}

const idle: Policy = () => "rest";

const competent: Policy = (v) => {
  const b = v.body;
  const night = v.hour >= 21.5 || v.hour < 5.5;
  const cold = v.env.ambient_temp_c < 12 || b.core_temp < 36.4;
  if (b.wounds.some((w) => !w.treated && w.severity > 0.05)) return "treat_wound";
  if (!v.inCabin && (night || cold) && b.stamina > 0) return "go_cabin";
  if (b.hydration < 60) {
    if (v.jarFill > 0 && v.jarQuality !== "river" && v.jarQuality !== "pool") return "drink_jar";
    return v.jarFill > 0 && v.jarQuality === "river" ? "boil" : "drink_spring";
  }
  if (v.jarFill < 2 && v.hour > 8 && v.hour < 19 && b.hydration > 60 && v.step % 4 === 0)
    return "refill_jar";
  if (b.satiety < 45) {
    // prefer known-safe food; unidentified berries only when nothing else is left
    if (v.food.dried! > 0) return "eat_dried";
    if (v.food.fruit! > 0) return "eat_fruit";
    if (v.food.roots! > 0) return "eat_roots";
    if (v.food.berries! > 0) return "eat_berries";
  }
  if (v.inCabin && (cold || night) && v.wood >= 3 && !v.fireNear) return "make_fire";
  if (v.inCabin && (cold || night) && !v.blanketWorn) return "wear_blanket";
  if (night || b.stamina < 25 || b.sleep_pressure > 0.85) return "sleep";
  if (v.wood < 4) return "chop";
  if (b.satiety < 75) return v.step % 2 ? "forage_roots" : "forage_fruit";
  if (v.fireNear && v.wood > 2 && v.step % 8 === 0) return "tend_fire";
  return "rest";
};

function randomPolicy(seed: number): Policy {
  const all: Choice[] = [
    "drink_jar",
    "drink_spring",
    "drink_river",
    "refill_jar",
    "boil",
    "eat_dried",
    "eat_fruit",
    "eat_roots",
    "eat_berries",
    "eat_mushrooms",
    "forage_berries",
    "forage_fruit",
    "forage_roots",
    "forage_mushrooms",
    "chop",
    "make_fire",
    "tend_fire",
    "wear_blanket",
    "sleep",
    "rest",
    "wander",
    "treat_wound",
    "go_cabin",
  ];
  return (v) => all[Math.floor(unitAt(seed ^ 0xabc, v.step) * all.length)]!;
}

describe("14-day policy simulation against the real world", () => {
  test("idle dies of dehydration about day 2; competent survives; random usually dies around day 4-6", () => {
    const idleR = [1, 2, 3].map((s) => run(idle, s));
    for (const r of idleR) {
      expect(r.alive).toBe(false);
      expect(r.cause).toBe("dehydration");
      expect(r.afterDays!).toBeGreaterThan(1.8);
      expect(r.afterDays!).toBeLessThan(2.3);
    }
    const comp = Array.from({ length: 10 }, (_, i) => run(competent, i + 1));
    expect(comp.filter((r) => r.alive).length).toBeGreaterThanOrEqual(8); // >= 80%
    const rnd = Array.from({ length: 20 }, (_, i) => run(randomPolicy(i + 1), i + 1));
    const dead = rnd.filter((r) => !r.alive).map((r) => r.afterDays!);
    expect(dead.length).toBeGreaterThanOrEqual(17); // usually dies
    const med = [...dead].sort((a, b) => a - b)[Math.floor(dead.length / 2)]!;
    expect(med).toBeGreaterThanOrEqual(4);
    expect(med).toBeLessThanOrEqual(6);
    // deaths are concentrated around days 4-6, not scattered or early (poisoning counted once)
    expect(dead.filter((d) => d >= 3 && d <= 8).length / dead.length).toBeGreaterThanOrEqual(0.75);
  }, 120_000);
});

describe.skipIf(!process.env.CAL)("calibration report", () => {
  test("report", () => {
    const setA = [101, 202, 303, 4040, 55555, 777, 8888, 99999, 1234, 31337, 424242, 17];
    const setB = Array.from({ length: 30 }, (_, i) => 5000 + i * 37);
    const seeds = [...setA, ...setB];
    const med = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? NaN;
    const idleR = seeds.map((s) => run(idle, s));
    const comp = seeds.map((s) => run(competent, s));
    const rnd = seeds.map((s) => run(randomPolicy(s), s));
    const causes = (rs: Out[]) => {
      const c: Record<string, number> = {};
      for (const r of rs) c[r.cause ?? "alive"] = (c[r.cause ?? "alive"] ?? 0) + 1;
      return JSON.stringify(c);
    };
    const d = (rs: Out[]) => rs.filter((r) => !r.alive).map((r) => r.afterDays!);
    console.log(
      `REPORT n=${seeds.length}\n idle median ${med(d(idleR)).toFixed(2)} dead ${d(idleR).length} ${causes(idleR)} min ${Math.min(...d(idleR)).toFixed(2)} max ${Math.max(...d(idleR)).toFixed(2)}\n competent alive ${comp.filter((r) => r.alive).length} deaths ${JSON.stringify(d(comp).map((x) => +x.toFixed(1)))} ${causes(comp)}\n random dead ${d(rnd).length} median ${med(d(rnd)).toFixed(2)} ${causes(rnd)} q ${JSON.stringify(
        d(rnd)
          .sort((a, b) => a - b)
          .map((x) => +x.toFixed(1)),
      )}`,
    );
  }, 600_000);
});
