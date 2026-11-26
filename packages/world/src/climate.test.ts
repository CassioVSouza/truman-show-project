import { describe, expect, test } from "vitest";
import {
  abundanceRamp,
  ambientTempOutside,
  dayLengthHours,
  daylightAt,
  seasonAt,
  timeOfDay,
  weatherAt,
  yearDays,
} from "./climate";
import { WORLD_CONFIG } from "./config";
import { hash32, rand01, rngFrom } from "./rng";

const clk = { seed: 42, genesisClock: 390 };
const DAY = 1440;

describe("rng", () => {
  test("deterministic and spread", () => {
    expect(hash32(1, 2, 3)).toBe(hash32(1, 2, 3));
    expect(hash32(1, 2, 3)).not.toBe(hash32(1, 2, 4));
    const r = rngFrom(5);
    const s = rngFrom(5);
    expect([r(), r(), r()]).toEqual([s(), s(), s()]);
    const xs = Array.from({ length: 2000 }, (_, i) => rand01(9, i));
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(mean).toBeGreaterThan(0.45);
    expect(mean).toBeLessThan(0.55);
  });
});

describe("climate", () => {
  test("ramp fades 1.5 to 1.0 over 14 days", () => {
    expect(abundanceRamp(0)).toBeCloseTo(1.5);
    expect(abundanceRamp(7 * DAY)).toBeCloseTo(1.25);
    expect(abundanceRamp(14 * DAY)).toBeCloseTo(1);
    expect(abundanceRamp(100 * DAY)).toBe(1);
  });
  test("seasons follow SEASON_DAYS", () => {
    const sd = WORLD_CONFIG.seasonDays;
    const seen = new Set<string>();
    for (let d = 0; d < sd * 4; d++) seen.add(seasonAt(d * DAY));
    expect(seen.size).toBe(4);
    expect(yearDays(sd * 4 * DAY)).toBeCloseTo(WORLD_CONFIG.genesisYearDays);
    expect(seasonAt(0)).toBe("spring");
  });
  test("summer is warmer and has longer days than winter", () => {
    const sd = WORLD_CONFIG.seasonDays;
    const avg = (from: number) => {
      let s = 0;
      for (let i = 0; i < sd * 24; i++) s += ambientTempOutside(clk, from * DAY + i * 60);
      return s / (sd * 24);
    };
    const summerStart = sd - WORLD_CONFIG.genesisYearDays;
    const winterStart = 3 * sd - WORLD_CONFIG.genesisYearDays;
    expect(avg(summerStart)).toBeGreaterThan(avg(winterStart) + 10);
    expect(dayLengthHours((summerStart + sd / 2) * DAY)).toBeGreaterThan(
      dayLengthHours((winterStart + sd / 2) * DAY) + 4,
    );
  });
  test("night is dark, noon is bright, nights are colder than afternoons", () => {
    const noon = 720 - clk.genesisClock;
    const night = DAY - clk.genesisClock; // midnight
    expect(timeOfDay(clk, night)).toBe("night");
    expect(daylightAt(clk, night)).toBeLessThan(0.15);
    expect(daylightAt(clk, noon)).toBeGreaterThan(0.5);
    let cold = 0;
    for (let d = 0; d < 20; d++) {
      if (ambientTempOutside(clk, night + d * DAY) < ambientTempOutside(clk, noon + 180 + d * DAY))
        cold++;
    }
    expect(cold).toBeGreaterThan(17);
  });
  test("weather is deterministic, constant within a block, and varied", () => {
    const a = weatherAt(clk, 1000);
    expect(weatherAt(clk, 1000)).toEqual(a);
    const kinds = new Set<string>();
    for (let b = 0; b < 400; b++) kinds.add(weatherAt(clk, b * 360).kind);
    expect(kinds.size).toBeGreaterThanOrEqual(4);
    const blockStart = 360 * 5 - clk.genesisClock;
    expect(weatherAt(clk, blockStart + 10)).toEqual(weatherAt(clk, blockStart + 50));
  });
  test("snow only when cold", () => {
    for (let b = 0; b < 800; b++) {
      const t = b * 360;
      if (weatherAt(clk, t).kind === "snow") expect(ambientTempOutside(clk, t)).toBeLessThan(6);
    }
  });
});
