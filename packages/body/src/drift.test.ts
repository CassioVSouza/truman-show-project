import { describe, expect, test } from "vitest";
import {
  advanceBody,
  catchUp,
  DEFAULT_BODY_CONFIG,
  newBody,
  type Activity,
  type BodyEnvironment,
  type BodyState,
} from "./index";

/** Hourly environment cycle; constant within each hour. */
function hourEnv(h: number, base: number, shelter: number): BodyEnvironment {
  const hod = h % 24;
  return {
    ambient_temp_c: base + 7 * Math.sin(((hod - 9) / 24) * 2 * Math.PI),
    wind: 0.1 + (0.3 * ((h * 7) % 5)) / 5,
    rain: h % 29 < 3 ? 0.6 : 0,
    daylight: hod > 6.5 && hod < 19.5 ? 1 : 0,
    shelter,
    fire_warmth: 0,
  };
}
const act = (h: number): Activity => ({ asleep: h % 24 < 6, effort: h % 3 === 0 ? 1.5 : 0.5 });

const scenarios: { name: string; base: number; shelter: number; water: boolean; food: boolean }[] =
  [
    { name: "dehydration, mild", base: 8, shelter: 0.5, water: false, food: true },
    { name: "dehydration, freezing", base: 2, shelter: 0.5, water: false, food: true },
    { name: "dehydration, hot exposed", base: 24, shelter: 0, water: false, food: true },
    { name: "starvation, mild", base: 12, shelter: 0.8, water: true, food: false },
    { name: "exposure, hard frost", base: -12, shelter: 0, water: true, food: true },
  ];

function run(
  seed: number,
  sc: (typeof scenarios)[number],
  coarse: boolean,
): { s: BodyState; ms: number } {
  const t0 = performance.now();
  let s = newBody({ seed });
  for (let h = 0; h < 24 * 14 && s.alive; h++) {
    if (sc.water) s.hydration = 90;
    if (sc.food) {
      s.satiety = 90;
      s.energy_reserve = 90;
    }
    s = (coarse ? catchUp : advanceBody)(s, hourEnv(h, sc.base, sc.shelter), act(h), 60).state;
  }
  return { s, ms: performance.now() - t0 };
}

describe("catch-up substep config", () => {
  test("coarse substep is small (drift reduced from the 10 minute default)", () => {
    expect(DEFAULT_BODY_CONFIG.coarseSubstepMin).toBeLessThanOrEqual(2);
  });
});

describe("multi-day lethal catch-up agrees with minute stepping", () => {
  for (const sc of scenarios)
    test(sc.name, () => {
      for (const seed of [1, 2, 3, 4, 5]) {
        const f = run(seed, sc, false);
        const c = run(seed, sc, true);
        expect(f.s.alive).toBe(false);
        expect(c.s.alive).toBe(false);
        expect(c.s.cause_of_death).toBe(f.s.cause_of_death);
        expect(Math.abs(c.s.t - f.s.t)).toBeLessThanOrEqual(1);
      }
    });

  test("14-day non-lethal catch-up stays cheap and close", () => {
    const sc = { name: "fed", base: 12, shelter: 0.8, water: true, food: true };
    const f = run(7, sc, false);
    const c = run(7, sc, true);
    console.log(`14-day catch-up ms: coarse ${c.ms.toFixed(1)}, fine ${f.ms.toFixed(1)}`);
    expect(c.s.alive).toBe(f.s.alive);
    expect(Math.abs(c.s.core_temp - f.s.core_temp)).toBeLessThan(0.02);
    expect(Math.abs(c.s.stamina - f.s.stamina)).toBeLessThan(0.1);
  });
});
