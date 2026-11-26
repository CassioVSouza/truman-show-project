import { BodyState, BodySignals } from "@truman/contracts";
import { describe, expect, test } from "vitest";
import {
  bodyEnvironmentFromWorld,
  bodySignals,
  vitals,
  PACKAGE,
  STARTING_SKILLS,
  addWound,
  advanceBody,
  catchUp,
  DEFAULT_BODY_CONFIG,
  competentPolicy,
  idlePolicy,
  INNATE_KNOW_HOW,
  newBody,
  performAction,
  practice,
  randomPolicy,
  simulatePolicy,
  skillHints,
  wakeReason,
  type BodyEnvironment,
} from "./index";

const mild: BodyEnvironment = {
  ambient_temp_c: 15,
  wind: 0.1,
  rain: 0,
  daylight: 1,
  shelter: 1,
  fire_warmth: 0,
};
const coldNight: BodyEnvironment = {
  ambient_temp_c: -2,
  wind: 0.5,
  rain: 0,
  daylight: 0,
  shelter: 0,
  fire_warmth: 0,
};
const hot: BodyEnvironment = {
  ambient_temp_c: 36,
  wind: 0,
  rain: 0,
  daylight: 1,
  shelter: 0,
  fire_warmth: 0,
};
const awake = { asleep: false, effort: 1 };

describe("body engine", () => {
  test("scaffold", () => expect(PACKAGE).toBe("body"));

  test("deterministic given seed", () => {
    const a = advanceBody(newBody({ seed: 7 }), coldNight, awake, 600);
    const b = advanceBody(newBody({ seed: 7 }), coldNight, awake, 600);
    expect(a.state).toEqual(b.state);
    expect(newBody({ seed: 7 }).immune).not.toBe(newBody({ seed: 8 }).immune);
  });

  test("rates follow config defaults (docs/10 s8)", () => {
    const r = advanceBody(newBody({ seed: 1 }), mild, awake, 60).state;
    expect(70 - r.satiety).toBeCloseTo(2, 0); // satiety -2/h
    expect(65 - r.hydration).toBeCloseTo(4, 0); // hydration -4/h
    expect(90 - r.stamina).toBeCloseTo(3.5, 0); // stamina -3.5/h awake
  });

  test("sleep restores stamina +12/h and drops pressure", () => {
    let b = newBody({ seed: 1 });
    b = { ...b, stamina: 30, sleep_pressure: 0.8 };
    const r = advanceBody(b, mild, { asleep: true, effort: 0 }, 60).state;
    expect(r.stamina - 30).toBeCloseTo(12, 0);
    expect(r.sleep_pressure).toBeLessThan(0.8);
  });

  test("cold exposure cools the core, shivers, then hypothermia drains health and logs", () => {
    const r = advanceBody(newBody({ seed: 2 }), { ...coldNight, rain: 0.8 }, awake, 12 * 60);
    expect(r.state.core_temp).toBeLessThan(35);
    expect(r.events.some((e) => e.kind === "shiver")).toBe(true);
    expect(r.state.ledger.exposure).toBeGreaterThan(0);
    expect(r.wake.some((w) => w.reason.includes("hypothermia"))).toBe(true);
  });

  test("heat makes the body sweat and raises hydration drain", () => {
    const r = advanceBody(newBody({ seed: 2 }), hot, { asleep: false, effort: 2 }, 120);
    expect(r.events.some((e) => e.kind === "sweat")).toBe(true);
    expect(65 - r.state.hydration).toBeGreaterThan(8);
  });

  test("exhaustion triggers micro-sleep and stumble reflexes", () => {
    const b = { ...newBody({ seed: 3 }), stamina: 6, sleep_pressure: 0.9 };
    const r = advanceBody(b, mild, { asleep: false, effort: 2 }, 60);
    expect(r.events.map((e) => e.kind)).toContain("micro_sleep");
    expect(r.events.map((e) => e.kind)).toContain("stumble");
  });

  test("very low health faints, early-wake requested", () => {
    const b = { ...newBody({ seed: 3 }), health: 9, hydration: 0 };
    const r = advanceBody(b, mild, awake, 5);
    expect(r.events.map((e) => e.kind)).toContain("faint");
    expect(r.wake.some((w) => w.reason.includes("health"))).toBe(true);
  });

  test("death is permanent and carries a causal report", () => {
    const dead = advanceBody(
      newBody({ seed: 4 }),
      mild,
      { asleep: false, effort: 0 },
      5 * 1440,
    ).state;
    expect(dead.alive).toBe(false);
    expect(dead.cause_of_death).toBe("dehydration");
    expect(dead.death_report?.chain.length).toBeGreaterThan(1);
    expect(dead.death_report?.chain.join(" ")).toMatch(/hydration reached zero/);
    const again = advanceBody(dead, mild, awake, 600);
    expect(again.state.alive).toBe(false);
    expect(again.state.t).toBe(dead.t);
    expect(
      performAction(dead, { type: "drink", hydration: 50 }, mild, STARTING_SKILLS).state.hydration,
    ).toBe(0);
  });

  test("wounds: infection rate and treatment", async () => {
    const { DEFAULT_BODY_CONFIG } = await import("./config");
    let untreated = 0;
    let treated = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const b = newBody({ seed });
      addWound(b, { type: "cut", location: "left hand", severity: 0.3 }, DEFAULT_BODY_CONFIG);
      const a = advanceBody(b, mild, awake, 1000).state;
      if (a.wounds.some((w) => w.infected) || a.conditions.some((c) => c.name === "infection"))
        untreated++;
      const t = performAction(b, { type: "treat_wound", quality: 1 }, mild, {
        ...STARTING_SKILLS,
        first_aid: 100,
      });
      const a2 = advanceBody(t.state, mild, awake, 1000).state;
      if (a2.wounds.some((w) => w.infected)) treated++;
    }
    expect(untreated).toBeGreaterThan(8);
    expect(untreated).toBeLessThan(40);
    expect(treated).toBeLessThan(untreated);
  });
});

describe("catch-up equals stepping", () => {
  const scenarios: [string, BodyEnvironment, number][] = [
    ["comfortable day", mild, 10 * 60],
    ["cold night", coldNight, 8 * 60],
    ["hot day", hot, 6 * 60],
  ];
  for (const [name, env, mins] of scenarios) {
    test(`coarse substep within tolerance: ${name}`, () => {
      const fine = advanceBody(newBody({ seed: 9 }), env, awake, mins).state;
      const coarse = catchUp(newBody({ seed: 9 }), env, awake, mins).state;
      for (const k of [
        "health",
        "satiety",
        "hydration",
        "stamina",
        "core_temp",
        "sleep_pressure",
        "wetness",
      ] as const) {
        expect(Math.abs(fine[k] - coarse[k])).toBeLessThan(k === "core_temp" ? 0.05 : 0.8);
      }
    });
  }
  test("minute stepping chained equals one long call exactly", () => {
    let s = newBody({ seed: 5 });
    for (let i = 0; i < 300; i++) s = advanceBody(s, coldNight, awake, 1).state;
    const once = advanceBody(newBody({ seed: 5 }), coldNight, awake, 300).state;
    expect(s).toEqual(once);
  });
});

describe("actions and skills", () => {
  test("drinking and eating restore the body", () => {
    let b = { ...newBody({ seed: 1 }), hydration: 20, satiety: 20 };
    b = performAction(b, { type: "drink", hydration: 40 }, mild, STARTING_SKILLS).state;
    b = performAction(b, { type: "eat", satiety: 25, reserve: 10 }, mild, STARTING_SKILLS).state;
    expect(b.hydration).toBeGreaterThan(50);
    expect(b.satiety).toBeGreaterThan(40);
  });

  test("river water sickens often unboiled, rarely boiled", () => {
    let raw = 0;
    let boiled = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const b = newBody({ seed });
      if (
        performAction(
          b,
          { type: "drink", hydration: 30, contamination: 0.35 },
          mild,
          STARTING_SKILLS,
        ).outcome.sickened
      )
        raw++;
      if (
        performAction(
          b,
          { type: "drink", hydration: 30, contamination: 0.35, boiled: true },
          mild,
          STARTING_SKILLS,
        ).outcome.sickened
      )
        boiled++;
    }
    expect(raw / 200).toBeGreaterThan(0.2);
    expect(raw / 200).toBeLessThan(0.45);
    expect(boiled).toBeLessThan(raw / 5);
  });

  test("toxic food poisons, vomit reflex fires", () => {
    const b = newBody({ seed: 11 });
    const r = performAction(b, { type: "eat", satiety: 20, reserve: 5, toxic: 1 }, mild, {
      ...STARTING_SKILLS,
      foraging: 0,
    });
    expect(r.outcome.sickened).toBe("toxin");
    const later = advanceBody(r.state, mild, awake, 240);
    expect(later.events.map((e) => e.kind)).toContain("vomit");
  });

  test("rotten food applies spoilage exactly once (world facts.toxic includes it; extra spoil ignored)", () => {
    // forward world eat facts unchanged: toxic already includes spoilage, spoil is informational
    const facts = { satiety: 20, reserve: 5, toxic: 0.3, spoil: 0.9 };
    let withSpoil = 0;
    let without = 0;
    const N = 600;
    for (let seed = 1; seed <= N; seed++) {
      const b = newBody({ seed });
      const sk = { ...STARTING_SKILLS, foraging: 0 };
      if (performAction(b, { type: "eat", ...facts }, mild, sk).outcome.sickened) withSpoil++;
      const noSpoil = { ...facts, spoil: 0 };
      if (performAction(b, { type: "eat", ...noSpoil }, mild, sk).outcome.sickened) without++;
    }
    expect(withSpoil).toBe(without); // identical draws: spoil adds nothing
    expect(withSpoil / N).toBeGreaterThan(0.24);
    expect(withSpoil / N).toBeLessThan(0.36);
  });

  test("sleep wakes early on pain or cold, and sleeping outside in cold is cut short", () => {
    const b = { ...newBody({ seed: 1 }), stamina: 20, sleep_pressure: 0.9 };
    const r = performAction(b, { type: "sleep", minutes: 480 }, coldNight, STARTING_SKILLS);
    expect(r.minutes).toBeLessThan(480);
    expect(r.interrupted).not.toBeNull();
    expect(wakeReason(newBody({ seed: 1 }))).toBeNull();
  });

  test("practice has diminishing returns; hints contain no numbers", () => {
    let s = STARTING_SKILLS;
    const gains: number[] = [];
    for (let i = 0; i < 30; i++) {
      const n = practice(s, "fishing", 1, 1);
      gains.push((n.fishing ?? 0) - (s.fishing ?? 0));
      s = n;
    }
    expect(gains[0]!).toBeGreaterThan(gains[29]!);
    for (const line of [...skillHints(s), ...INNATE_KNOW_HOW]) expect(line).not.toMatch(/\d/);
  });
});

describe("14-day policy simulation (stub world; rerun against the real world)", () => {
  test("idle dies of dehydration around day 2", () => {
    const r = simulatePolicy(idlePolicy, { seed: 1 });
    expect(r.alive).toBe(false);
    expect(r.cause).toBe("dehydration");
    expect(r.died_after_days!).toBeGreaterThan(1.7);
    expect(r.died_after_days!).toBeLessThan(2.6);
  });

  test("competent survives 14 days (most seeds)", () => {
    let alive = 0;
    for (let seed = 1; seed <= 10; seed++)
      if (simulatePolicy(competentPolicy, { seed }).alive) alive++;
    expect(alive).toBeGreaterThanOrEqual(9);
  }, 20_000);

  test("random usually dies, mostly by day 4-6", () => {
    const days: number[] = [];
    for (let seed = 1; seed <= 20; seed++) {
      const r = simulatePolicy(randomPolicy(seed), { seed });
      if (!r.alive) days.push(r.died_day!);
    }
    expect(days.length).toBeGreaterThanOrEqual(14);
    const med = [...days].sort((a, b) => a - b)[Math.floor(days.length / 2)]!;
    expect(med).toBeGreaterThanOrEqual(3);
    expect(med).toBeLessThanOrEqual(7);
  });
});

describe("world adapter", () => {
  test("maps contracts Environment onto body environment without double counting shelter", () => {
    const e = bodyEnvironmentFromWorld({
      ambient_temp_c: 5,
      fire_heat_c: 7,
      wind: 0.2,
      wetness_rate: 0.3,
      daylight: 0,
    });
    expect(e.shelter).toBe(0);
    expect(e.fire_warmth).toBeCloseTo(0.5, 5);
    expect(e.rain).toBe(0.3);
  });
});

describe("contract conformance", () => {
  test("vitals() satisfies the contracts BodyState (fresh and stressed) and bodySignals the BodySignals schema", () => {
    const fresh = newBody({ seed: 3 });
    const hurt = newBody({ seed: 4 });
    addWound(hurt, { type: "cut", location: "left hand", severity: 0.5 }, DEFAULT_BODY_CONFIG);
    const poisoned = performAction(
      hurt,
      { type: "eat", satiety: 5, reserve: 1, toxic: 1 },
      coldNight,
      { ...STARTING_SKILLS, foraging: 0 },
    ).state;
    const stressed = advanceBody(poisoned, coldNight, awake, 600).state;
    expect(stressed.conditions.length + stressed.wounds.length).toBeGreaterThan(0);
    for (const b of [fresh, stressed]) {
      const r = BodyState.safeParse(vitals(b));
      expect(r.success, JSON.stringify(r.error?.issues)).toBe(true);
      expect(BodySignals.safeParse(bodySignals(b)).success).toBe(true);
    }
  });
});
