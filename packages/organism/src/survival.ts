import { clamp } from "./rng";
import type { BodySignals, SurvivalChannels } from "./types";

const ramp = (x: number, lo: number, hi: number) => clamp((x - lo) / (hi - lo), 0, 1);

/** Hidden drive intensities (0..1) derived from the body. Used by urges and organism targets. */
export function bodyDrives(b: BodySignals) {
  const hunger = ramp(45 - b.satiety, 0, 45) * (b.energy_reserve < 30 ? 1 : 0.85);
  const thirst = ramp(60 - b.hydration, 0, 60);
  const cold = Math.max(ramp(36.7 - b.core_temp, 0, 1.7), b.shiver * 0.6);
  const heat = ramp(b.core_temp - 37.4, 0, 1.6);
  const weak = Math.max(ramp(35 - b.health, 0, 35), ramp(40 - b.stamina, 0, 40) * 0.7);
  const sleepy = b.asleep ? 0 : Math.max(b.sleep_pressure, ramp(50 - b.stamina, 0, 50));
  const discomfort =
    1 -
    (1 - hunger * 0.8) *
      (1 - thirst * 0.9) *
      (1 - cold) *
      (1 - heat) *
      (1 - b.pain) *
      (1 - b.illness * 0.7);
  return { hunger, thirst, cold, heat, weak, sleepy, discomfort };
}

/** Survival channels (doc 08 extra vocabulary) from body signals. */
export function deriveSurvival(b: BodySignals): SurvivalChannels {
  const d = bodyDrives(b);
  const lowHealth = ramp(40 - b.health, 0, 40);
  return {
    stomach_emptiness: d.hunger,
    stomach_ache: ramp(25 - b.satiety, 0, 25) * ramp(30 - b.energy_reserve, 0, 30),
    nausea: clamp(b.nausea * 1.4, 0, 1),
    dry_mouth: ramp(55 - b.hydration, 0, 55),
    thirst_head: ramp(25 - b.hydration, 0, 25),
    shivering: b.shiver,
    numb_extremities: Math.max(ramp(35.8 - b.core_temp, 0, 1.8), b.wetness * d.cold),
    sweating: b.sweat,
    flushed_heat: Math.max(d.heat, b.fever * 0.9),
    fever_chills: b.fever > 0.15 ? clamp(b.fever * 1.2, 0, 1) : 0,
    dizziness: Math.max(
      lowHealth * 0.9,
      ramp(15 - b.hydration, 0, 15) * 0.7,
      b.nausea * 0.6,
      ramp(b.sleep_pressure - 0.85, 0, 0.15) * 0.6,
    ),
    trembling_weakness: Math.max(
      ramp(30 - b.stamina, 0, 30),
      ramp(12 - b.satiety, 0, 12) * 0.6,
      lowHealth * 0.7,
    ),
    blurred_sight: Math.max(
      ramp(b.sleep_pressure - 0.8, 0, 0.2),
      ramp(15 - b.hydration, 0, 15) * 0.6,
      lowHealth * 0.5,
    ),
    ringing_ears: Math.max(ramp(25 - b.health, 0, 25), ramp(8 - b.hydration, 0, 8) * 0.5),
    heavy_limbs: Math.max(ramp(45 - b.stamina, 0, 45), b.illness * 0.6),
    wounds: b.wounds.map((w) => ({
      location: w.location,
      type: w.type,
      intensity: clamp(w.severity * 1.3, 0, 1),
    })),
  };
}
