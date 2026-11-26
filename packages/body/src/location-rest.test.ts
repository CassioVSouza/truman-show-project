import { describe, expect, test } from "vitest";
import {
  advanceBody,
  bodyEnvironmentFromWorld,
  newBody,
  performAction,
  STARTING_SKILLS,
  type BodyEnvironment,
} from "./index";

const base = { wind: 0.3, daylight: 0, fire_warmth: 0, shelter: 0 };
const cabin: BodyEnvironment = { ...base, ambient_temp_c: 8, rain: 0, wind: 0.05, rest_cover: 1 };
const openCold: BodyEnvironment = { ...base, ambient_temp_c: 2, rain: 0, rest_cover: 0 };
const openRain: BodyEnvironment = { ...base, ambient_temp_c: 8, rain: 0.8, rest_cover: 0 };
const openMild: BodyEnvironment = { ...base, ambient_temp_c: 18, rain: 0, rest_cover: 0 };

function tired() {
  const b = newBody({ seed: 3 });
  b.stamina = 30;
  b.sleep_pressure = 0.8;
  return b;
}
function sleep(env: BodyEnvironment, min = 240) {
  return advanceBody(tired(), env, { asleep: true, effort: 0 }, min).state;
}

describe("location-aware rest", () => {
  test("same sleep restores less outdoors in cold/rain than in a cabin", () => {
    const c = sleep(cabin);
    for (const env of [openCold, openRain]) {
      const o = sleep(env);
      expect(o.stamina).toBeLessThan(c.stamina);
      expect(o.sleep_pressure).toBeGreaterThan(c.sleep_pressure);
    }
    expect(sleep(openCold).core_temp).toBeLessThan(c.core_temp);
    expect(sleep(openRain).wetness).toBeGreaterThan(c.wetness);
  });

  test("sleeping outdoors is still allowed and still restores something", () => {
    const o = sleep(openMild);
    expect(o.alive).toBe(true);
    expect(o.stamina).toBeGreaterThan(30);
    const r = performAction(tired(), { type: "sleep", minutes: 120 }, openRain, STARTING_SKILLS);
    expect(r.state.stamina).toBeGreaterThan(30);
  });

  test("mild open ground costs a little; weather costs more", () => {
    expect(sleep(openMild).stamina).toBeLessThan(sleep(cabin).stamina);
    expect(sleep(openRain).stamina).toBeLessThan(sleep(openMild).stamina);
  });

  test("world adapter maps cabin/canopy/open to rest cover", () => {
    const w = { ambient_temp_c: 5, fire_heat_c: 0, wind: 0, wetness_rate: 0, daylight: 0 };
    expect(
      bodyEnvironmentFromWorld({ ...w, shelter: "cabin", shelter_quality: 0.9 }).rest_cover,
    ).toBe(1);
    expect(bodyEnvironmentFromWorld({ ...w, shelter: "open", shelter_quality: 0 }).rest_cover).toBe(
      0,
    );
    const c = bodyEnvironmentFromWorld({
      ...w,
      shelter: "canopy",
      shelter_quality: 0.4,
    }).rest_cover!;
    expect(c).toBeGreaterThan(0);
    expect(c).toBeLessThan(1);
  });
});
