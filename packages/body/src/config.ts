// All rates are config defaults from docs/10 section 8; tune here, never hard-code elsewhere.
import type { DeathCause, WoundType } from "./types";

export interface BodyConfig {
  satietyDrainPerH: number;
  reserveDrainPerH: number; // only while satiety is empty
  hydrationDrainPerH: number;
  hotHydrationMult: number;
  hotEffectiveTemp: number; // effective temp above which hydration drains faster
  staminaDrainAwakePerH: number;
  staminaRestPerH: number; // awake and resting
  sleepRestorePerH: number;
  /** Rest-quality model: how open ground, cold, damp and wind degrade sleep (config only, never shown). */
  restOpenPenalty: number; // quality lost sleeping with no cover at all, even in mild weather
  restDiscomfortMax: number; // max extra loss from cold/wet/wind
  restColdSpanC: number; // degrees below neutral for full cold discomfort
  restWetWeight: number;
  restWindWeight: number;
  restMinQuality: number;
  restChillMult: number; // extra chill accrual while asleep uncovered
  sleepPressureBuildPerH: number;
  sleepPressureDropPerH: number;
  healthRegenPerH: number;
  starvationDrainPerH: number;
  starvationRamp: number; // reserve below this ramps the drain in
  dehydrationDrainPerH: number;
  dehydrationRamp: number;
  hypothermiaBelowC: number;
  hypothermiaDrainPerH: number;
  heatstrokeAboveC: number;
  heatstrokeDrainPerH: number;
  // thermoregulation
  neutralLowE: number; // effective temp below which the core cools
  neutralHighE: number;
  coolPerDegree: number;
  warmPerDegree: number;
  coreTauCoolMin: number;
  coreTauWarmMin: number;
  skinTauMin: number;
  insulationC: number; // effective degrees per unit insulation
  windChillC: number;
  wetChillC: number;
  fireWarmC: number;
  shelterWarmC: number;
  effortHeatC: number;
  wetGainPerMin: number;
  dryPerMin: number;
  feverCoreRise: number;
  // wounds
  woundDrainPerH: Record<WoundType, number>;
  woundPain: Record<WoundType, number>;
  woundHealPerH: Record<WoundType, number>;
  treatedHealMult: number;
  infectionChanceUntreated: number;
  infectionAfterMin: [number, number];
  infectedGrowthPerH: number;
  // illness
  illnessDrainPerH: Record<"food_poisoning" | "fever" | "cold" | "infection", number>;
  illnessRecoverPerH: number;
  chillCoreC: number;
  coldOnsetChillMin: number;
  immuneTauMin: number;
  // reflexes / thresholds
  microSleepStamina: number;
  microSleepPressure: number;
  microSleepMin: number;
  faintHealth: number;
  faintMin: number;
  stumbleStamina: number;
  lowHealthWake: number;
  severeHypoC: number;
  ledgerTauMin: number;
  historyEveryMin: number;
  // stepping
  fineSubstepMin: number;
  coarseSubstepMin: number;
  start: {
    health: number;
    satiety: number;
    energy_reserve: number;
    hydration: number;
    stamina: number;
    sleep_pressure: number;
    insulation: number;
    immune: number;
  };
}

export const DEFAULT_BODY_CONFIG: BodyConfig = {
  satietyDrainPerH: 2,
  reserveDrainPerH: 2,
  hydrationDrainPerH: 4,
  hotHydrationMult: 1.5,
  hotEffectiveTemp: 30,
  staminaDrainAwakePerH: 3.5,
  staminaRestPerH: 2,
  sleepRestorePerH: 12,
  restOpenPenalty: 0.1,
  restDiscomfortMax: 0.35,
  restColdSpanC: 12,
  restWetWeight: 0.5,
  restWindWeight: 0.3,
  restMinQuality: 0.3,
  restChillMult: 0.3,
  sleepPressureBuildPerH: 1 / 16,
  sleepPressureDropPerH: 0.14,
  healthRegenPerH: 1,
  starvationDrainPerH: 2,
  starvationRamp: 5,
  dehydrationDrainPerH: 4,
  dehydrationRamp: 8,
  hypothermiaBelowC: 35,
  hypothermiaDrainPerH: 3,
  heatstrokeAboveC: 39,
  heatstrokeDrainPerH: 3,
  neutralLowE: 14,
  neutralHighE: 30,
  coolPerDegree: 0.14,
  warmPerDegree: 0.1,
  coreTauCoolMin: 120,
  coreTauWarmMin: 90,
  skinTauMin: 15,
  insulationC: 10,
  windChillC: 8,
  wetChillC: 8,
  fireWarmC: 14,
  shelterWarmC: 4,
  effortHeatC: 3,
  wetGainPerMin: 0.02,
  dryPerMin: 0.004,
  feverCoreRise: 1.8,
  woundDrainPerH: { cut: 0.8, bruise: 0, burn: 0.8, sprain: 0, bite: 1.2 },
  woundPain: { cut: 0.5, bruise: 0.3, burn: 0.8, sprain: 0.6, bite: 0.8 },
  woundHealPerH: { cut: 0.012, bruise: 0.015, burn: 0.008, sprain: 0.006, bite: 0.008 },
  treatedHealMult: 2,
  infectionChanceUntreated: 0.5,
  infectionAfterMin: [240, 900],
  infectedGrowthPerH: 0.01,
  illnessDrainPerH: { food_poisoning: 4, fever: 1.6, cold: 0.4, infection: 2.5 },
  illnessRecoverPerH: 0.04,
  chillCoreC: 36.2,
  coldOnsetChillMin: 300,
  immuneTauMin: 1440,
  microSleepStamina: 2,
  microSleepPressure: 0.97,
  microSleepMin: 10,
  faintHealth: 10,
  faintMin: 30,
  stumbleStamina: 5,
  lowHealthWake: 25,
  severeHypoC: 34,
  ledgerTauMin: 720,
  historyEveryMin: 60,
  fineSubstepMin: 1,
  coarseSubstepMin: 2,
  start: {
    health: 100,
    satiety: 70,
    energy_reserve: 60,
    hydration: 65,
    stamina: 90,
    sleep_pressure: 0.1,
    insulation: 0.5,
    immune: 0.5,
  },
};

export type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

function merge(base: unknown, over: unknown): unknown {
  if (!over || typeof over !== "object" || Array.isArray(over)) return over ?? base;
  const out = base as Record<string, unknown>;
  for (const [k, v] of Object.entries(over as Record<string, unknown>)) {
    const cur = out[k];
    out[k] =
      cur && typeof cur === "object" && !Array.isArray(cur) && v && typeof v === "object"
        ? merge(cur, v)
        : v;
  }
  return out;
}

export function makeBodyConfig(over: DeepPartial<BodyConfig> = {}): BodyConfig {
  return merge(structuredClone(DEFAULT_BODY_CONFIG), over) as BodyConfig;
}

export const ALL_CAUSES: DeathCause[] = [
  "starvation",
  "dehydration",
  "exposure",
  "injury",
  "illness",
  "poisoning",
];
