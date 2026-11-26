// Body engine: pure, deterministic given (state, env, activity, dt). Hidden truth; never shown to the Resident.
import type { BodySignals } from "@truman/contracts";
import { ALL_CAUSES, type BodyConfig, DEFAULT_BODY_CONFIG } from "./config";
import { unitAt } from "./rng";
import type {
  Activity,
  BodyEnvironment,
  BodyState,
  Condition,
  ConditionName,
  DeathCause,
  DeathReport,
  HistorySample,
  ReflexEvent,
  StepResult,
  WakeRequest,
  WorldEnvironmentLike,
  Wound,
} from "./types";

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const zeroLedger = (): Record<DeathCause, number> => ({
  starvation: 0,
  dehydration: 0,
  exposure: 0,
  injury: 0,
  illness: 0,
  poisoning: 0,
});

export interface NewBodyOptions {
  seed: number;
  birth_ms?: number;
  config?: BodyConfig;
}

/** Create a living body. Temperament-like variation of immunity is drawn from the seed. */
export function newBody(opts: NewBodyOptions): BodyState {
  const cfg = opts.config ?? DEFAULT_BODY_CONFIG;
  const immune = clamp(cfg.start.immune + (unitAt(opts.seed, 9001) - 0.5) * 0.2, 0.2, 0.9);
  return {
    health: cfg.start.health,
    satiety: cfg.start.satiety,
    energy_reserve: cfg.start.energy_reserve,
    hydration: cfg.start.hydration,
    core_temp: 37,
    skin_temp: 33,
    wetness: 0,
    stamina: cfg.start.stamina,
    sleep_pressure: cfg.start.sleep_pressure,
    immune,
    wounds: [],
    conditions: [],
    alive: true,
    cause_of_death: null,
    nutrient_balance: 0.5,
    insulation: cfg.start.insulation,
    shiver: 0,
    sweat: 0,
    asleep: false,
    t: 0,
    birth_ms: opts.birth_ms ?? Date.UTC(2026, 0, 1, 7, 0, 0),
    seed: opts.seed >>> 0,
    rng_ctr: 0,
    immune_base: immune,
    chill_min: 0,
    micro_sleep_until: -1,
    unconscious_until: -1,
    next_wound_id: 1,
    prev_fire: 0,
    ledger: zeroLedger(),
    flags: {},
    marks: {},
    history: [],
    timeline: [],
    death_report: null,
  };
}

export function isoAt(s: BodyState, t: number): string {
  return new Date(s.birth_ms + t * 60000).toISOString();
}

/** Effective temperature the body experiences (ambient + insulation, wind, wet, fire, shelter, effort). */
export function effectiveTemp(
  s: BodyState,
  env: BodyEnvironment,
  effort: number,
  cfg: BodyConfig,
): number {
  const exposedWind = env.wind * (1 - env.shelter * 0.8);
  return (
    env.ambient_temp_c +
    cfg.insulationC * s.insulation -
    cfg.windChillC * exposedWind -
    cfg.wetChillC * s.wetness +
    cfg.fireWarmC * env.fire_warmth +
    cfg.shelterWarmC * env.shelter +
    cfg.effortHeatC * (effort - 1)
  );
}

export function painOf(s: BodyState, cfg: BodyConfig): number {
  let p = 0;
  for (const w of s.wounds) p += w.severity * cfg.woundPain[w.type];
  for (const c of s.conditions) p += c.severity * (c.name === "infection" ? 0.5 : 0.25);
  return 1 - Math.exp(-p * 1.6);
}

function needsMet(s: BodyState): boolean {
  return (
    s.hydration > 15 &&
    (s.satiety > 5 || s.energy_reserve > 20) &&
    s.core_temp > 35.5 &&
    s.core_temp < 38.5 &&
    !s.conditions.some((c) => c.severity > 0.2) &&
    !s.wounds.some((w) => w.infected)
  );
}

function pushEvent(s: BodyState, ev: ReflexEvent[], e: ReflexEvent): void {
  ev.push(e);
  s.timeline.push(e);
  if (s.timeline.length > 120) s.timeline.shift();
}

function mark(s: BodyState, key: string): void {
  if (s.marks[key] === undefined) s.marks[key] = s.t;
}

/** Rising edge detector: true only when `on` flips from false to true; re-arms when `rearm` is true. */
function edge(s: BodyState, key: string, on: boolean, rearm: boolean): boolean {
  if (on && !s.flags[key]) {
    s.flags[key] = true;
    return true;
  }
  if (rearm) s.flags[key] = false;
  return false;
}

export function addCondition(
  s: BodyState,
  name: ConditionName,
  peak: number,
  rampMin: number,
  source: Condition["source"],
  ev: ReflexEvent[] = [],
): void {
  const cur = s.conditions.find((c) => c.name === name);
  if (cur) {
    cur.peak = Math.max(cur.peak, peak);
    return;
  }
  s.conditions.push({
    name,
    severity: 0.01,
    since: isoAt(s, s.t),
    source,
    peak,
    ramp_min: rampMin,
    age_min: 0,
  });
  mark(s, `illness_${name}`);
  pushEvent(s, ev, {
    t: s.t,
    kind: "illness_started",
    detail: `${name} began (${source})`,
    data: { name },
  });
}

export function addWound(
  s: BodyState,
  w: { type: Wound["type"]; location: string; severity: number },
  cfg: BodyConfig,
  ev: ReflexEvent[] = [],
  wake?: WakeRequest[],
): Wound {
  s.rng_ctr += 1;
  const rollInfect = unitAt(s.seed, s.rng_ctr);
  s.rng_ctr += 1;
  const rollWhen = unitAt(s.seed, s.rng_ctr);
  const risky = w.type === "cut" || w.type === "bite" || w.type === "burn";
  const wound: Wound = {
    id: s.next_wound_id++,
    type: w.type,
    location: w.location,
    severity: clamp(w.severity, 0.02, 1),
    infected: false,
    treated: false,
    age_min: 0,
    infect_at:
      risky && rollInfect < cfg.infectionChanceUntreated
        ? cfg.infectionAfterMin[0] +
          rollWhen * (cfg.infectionAfterMin[1] - cfg.infectionAfterMin[0])
        : null,
  };
  s.wounds.push(wound);
  mark(s, "wound");
  pushEvent(s, ev, {
    t: s.t,
    kind: "injury",
    detail: `${w.type} on ${w.location}, severity ${wound.severity.toFixed(2)}`,
    data: { id: wound.id, type: w.type, location: w.location },
  });
  if (wake && wound.severity >= 0.3) wake.push({ t: s.t, reason: "sudden injury", in_min: 1 });
  return wound;
}

function stepOnce(
  s: BodyState,
  env: BodyEnvironment,
  actIn: Activity,
  dt: number,
  cfg: BodyConfig,
  ev: ReflexEvent[],
  wake: WakeRequest[],
): void {
  const h = dt / 60;
  let asleep = actIn.asleep;
  let effort = actIn.effort;
  if (s.t < s.unconscious_until || s.t < s.micro_sleep_until) {
    asleep = true;
    effort = 0;
  }
  if (asleep) effort = 0;
  s.asleep = asleep;

  // ---------- thermoregulation ----------
  const rainOn = env.rain * (1 - env.shelter * 0.95) + (env.immersion ?? 0);
  s.wetness = clamp(
    s.wetness +
      cfg.wetGainPerMin * dt * rainOn -
      cfg.dryPerMin *
        dt *
        (1 + env.fire_warmth * 2 + env.wind * 0.5 + Math.max(0, env.ambient_temp_c - 5) / 20) *
        (rainOn > 0.05 ? 0 : 1),
    0,
    1,
  );
  const E = effectiveTemp(s, env, effort, cfg);
  const fever = s.conditions.find((c) => c.name === "fever")?.severity ?? 0;
  let coreEq = 37 + fever * cfg.feverCoreRise;
  if (E < cfg.neutralLowE) coreEq -= cfg.coolPerDegree * (cfg.neutralLowE - E);
  else if (E > cfg.neutralHighE) coreEq += cfg.warmPerDegree * (E - cfg.neutralHighE);
  const tau = coreEq < s.core_temp ? cfg.coreTauCoolMin : cfg.coreTauWarmMin;
  s.core_temp += (coreEq - s.core_temp) * (1 - Math.exp(-dt / tau));
  const skinEq = clamp(33 - 0.45 * Math.max(0, 22 - E) + 0.2 * Math.max(0, E - 30), 8, 37);
  s.skin_temp += (skinEq - s.skin_temp) * (1 - Math.exp(-dt / cfg.skinTauMin));
  s.shiver = clamp((36.8 - s.core_temp) / 1.5 + Math.max(0, cfg.neutralLowE - 4 - E) / 30, 0, 1);
  s.sweat = clamp((s.core_temp - 37.2) / 1.0 + Math.max(0, E - cfg.neutralHighE) / 20, 0, 1);

  // ---------- metabolism, hydration, stamina ----------
  const metab = (asleep ? 0.6 : 0.7 + 0.3 * effort) + 0.5 * s.shiver;
  const drain = cfg.satietyDrainPerH * metab * h;
  if (s.satiety >= drain) s.satiety -= drain;
  else {
    const over = (drain - s.satiety) / drain;
    s.satiety = 0;
    s.energy_reserve = Math.max(0, s.energy_reserve - cfg.reserveDrainPerH * metab * h * over);
  }
  const hot = E > cfg.hotEffectiveTemp ? cfg.hotHydrationMult : 1;
  s.hydration = Math.max(
    0,
    s.hydration -
      cfg.hydrationDrainPerH * (asleep ? 0.6 : 0.7 + 0.3 * effort) * hot * (1 + 0.3 * fever) * h,
  );
  if (asleep) s.stamina = Math.min(100, s.stamina + cfg.sleepRestorePerH * h);
  else {
    const rate =
      effort < 1
        ? cfg.staminaRestPerH + (-cfg.staminaDrainAwakePerH - cfg.staminaRestPerH) * effort
        : -cfg.staminaDrainAwakePerH * effort;
    s.stamina = clamp(s.stamina + (rate - 1.5 * s.shiver) * h, 0, 100);
  }
  s.sleep_pressure = clamp(
    s.sleep_pressure + (asleep ? -cfg.sleepPressureDropPerH : cfg.sleepPressureBuildPerH) * h,
    0,
    1,
  );
  s.nutrient_balance += (0.5 - s.nutrient_balance) * (1 - Math.exp(-dt / 2880));

  // ---------- wounds ----------
  const met = needsMet(s);
  const dmg = zeroLedger();
  const keep: Wound[] = [];
  for (const w of s.wounds) {
    w.age_min += dt;
    if (!w.infected && !w.treated && w.infect_at !== null && w.age_min >= w.infect_at) {
      w.infected = true;
      mark(s, "infection");
      pushEvent(s, ev, {
        t: s.t,
        kind: "wound_infected",
        detail: `${w.type} on ${w.location} infected`,
        data: { id: w.id },
      });
      addCondition(s, "infection", 0.7, 720, "wound", ev);
    }
    dmg.injury += cfg.woundDrainPerH[w.type] * w.severity * (w.treated ? 0.2 : 1) * h;
    if (w.infected) w.severity = Math.min(1, w.severity + cfg.infectedGrowthPerH * h);
    else {
      w.severity -=
        cfg.woundHealPerH[w.type] *
        (w.treated ? cfg.treatedHealMult : 1) *
        (0.5 + s.immune) *
        (met ? 1 : 0.3) *
        h;
    }
    if (w.severity > 0.02) keep.push(w);
  }
  s.wounds = keep;

  // ---------- conditions ----------
  const blockInfection = s.wounds.some((w) => w.infected && !w.treated);
  const left: Condition[] = [];
  for (const c of s.conditions) {
    c.age_min += dt;
    if (c.age_min < c.ramp_min)
      c.severity = Math.max(c.severity, c.peak * (c.age_min / c.ramp_min));
    else if (c.name === "infection" && blockInfection)
      c.severity = Math.min(c.peak, c.severity + 0.01 * h);
    else {
      const calm = asleep || effort <= 0.5 ? 1.3 : 1;
      c.severity -=
        cfg.illnessRecoverPerH * (0.5 + s.immune) * calm * (s.hydration > 20 ? 1 : 0.5) * h;
    }
    if (
      c.name === "food_poisoning" &&
      c.severity >= 0.35 &&
      edge(s, `vomit_${c.since}`, true, false)
    ) {
      s.satiety = Math.max(0, s.satiety - 25);
      s.hydration = Math.max(0, s.hydration - 8);
      pushEvent(s, ev, { t: s.t, kind: "vomit", detail: "vomited (reflex)" });
    }
    if (
      c.name === "infection" &&
      c.severity > 0.5 &&
      !s.conditions.some((x) => x.name === "fever") &&
      !left.some((x) => x.name === "fever")
    ) {
      left.push({
        name: "fever",
        severity: 0.01,
        since: isoAt(s, s.t),
        source: "body",
        peak: 0.6,
        ramp_min: 360,
        age_min: 0,
      });
      mark(s, "illness_fever");
    }
    if (c.age_min >= c.ramp_min && c.severity < 0.03) {
      pushEvent(s, ev, {
        t: s.t,
        kind: "illness_resolved",
        detail: `${c.name} resolved`,
        data: { name: c.name },
      });
      if (c.name === "infection") s.wounds.forEach((w) => (w.infected = false));
      s.immune_base = Math.min(0.95, s.immune_base + 0.01);
      continue;
    }
    const cause: DeathCause =
      c.name === "food_poisoning" && c.source === "toxin" ? "poisoning" : "illness";
    dmg[cause] += cfg.illnessDrainPerH[c.name] * c.severity * h;
    left.push(c);
  }
  s.conditions = left;
  if (s.core_temp < cfg.chillCoreC) s.chill_min += dt;
  else s.chill_min = Math.max(0, s.chill_min - 0.5 * dt);
  if (s.chill_min >= cfg.coldOnsetChillMin && !s.conditions.some((c) => c.name === "cold")) {
    addCondition(s, "cold", 0.5, 480, "exposure", ev);
    s.chill_min = 0;
  }
  // immune system follows deprivation
  const deprived =
    (s.satiety > 15 ? 1 : 0.6) * (s.hydration > 20 ? 1 : 0.7) * (s.stamina > 20 ? 1 : 0.8);
  s.immune += (s.immune_base * deprived - s.immune) * (1 - Math.exp(-dt / cfg.immuneTauMin));

  // ---------- health drains and regeneration ----------
  if (s.energy_reserve <= 0 && s.satiety <= 0) {
    dmg.starvation +=
      cfg.starvationDrainPerH * h * clamp(1 - s.energy_reserve / cfg.starvationRamp, 0, 1);
  }
  dmg.dehydration +=
    cfg.dehydrationDrainPerH * h * clamp(1 - s.hydration / cfg.dehydrationRamp, 0, 1);
  if (s.core_temp < cfg.hypothermiaBelowC) {
    dmg.exposure +=
      cfg.hypothermiaDrainPerH *
      h *
      clamp(cfg.hypothermiaBelowC - s.core_temp, 0, 1) *
      (s.core_temp < 33 ? 2 : 1);
  }
  if (s.core_temp > cfg.heatstrokeAboveC)
    dmg.exposure += cfg.heatstrokeDrainPerH * h * clamp(s.core_temp - cfg.heatstrokeAboveC, 0, 1);
  let total = 0;
  const decay = Math.exp(-dt / cfg.ledgerTauMin);
  for (const k of ALL_CAUSES) {
    s.ledger[k] = s.ledger[k] * decay + dmg[k];
    total += dmg[k];
  }
  if (s.hydration <= 0) mark(s, "hydration_empty");
  if (s.satiety <= 0) mark(s, "satiety_empty");
  if (s.energy_reserve <= 0) mark(s, "reserve_empty");
  if (s.core_temp < cfg.hypothermiaBelowC) mark(s, "hypothermia");
  if (s.core_temp > cfg.heatstrokeAboveC) mark(s, "hyperthermia");
  let regen = 0;
  if (total === 0 && met) regen = cfg.healthRegenPerH * h * (asleep ? 1.5 : 1);
  s.health = Math.min(100, s.health + regen - total);

  // ---------- reflexes and early-wake edges ----------
  if (edge(s, "shiver", s.shiver > 0.25, s.shiver < 0.1))
    pushEvent(s, ev, { t: s.t, kind: "shiver", detail: "shivering began (reflex)" });
  if (edge(s, "sweat", s.sweat > 0.25, s.sweat < 0.1))
    pushEvent(s, ev, { t: s.t, kind: "sweat", detail: "sweating began (reflex)" });
  if (
    !asleep &&
    s.t >= s.micro_sleep_until &&
    (s.stamina <= cfg.microSleepStamina || s.sleep_pressure >= cfg.microSleepPressure)
  ) {
    s.micro_sleep_until = s.t + cfg.microSleepMin;
    pushEvent(s, ev, {
      t: s.t,
      kind: "micro_sleep",
      detail: "micro-sleep from exhaustion (reflex)",
    });
  }
  if (edge(s, "stumble", !asleep && s.stamina < cfg.stumbleStamina, s.stamina > 20)) {
    pushEvent(s, ev, { t: s.t, kind: "stumble", detail: "stumbled from exhaustion (reflex)" });
    addWound(s, { type: "bruise", location: "left knee", severity: 0.1 }, cfg, ev);
  }
  if (
    s.health > 0 &&
    s.health < cfg.faintHealth &&
    s.t >= s.unconscious_until &&
    edge(s, "faint", true, false)
  ) {
    s.unconscious_until = s.t + cfg.faintMin;
    pushEvent(s, ev, { t: s.t, kind: "faint", detail: "fainted at very low health (reflex)" });
  }
  if (s.health > cfg.faintHealth + 10) s.flags.faint = false;
  if (edge(s, "low_health", s.health < cfg.lowHealthWake, s.health > cfg.lowHealthWake + 10))
    wake.push({ t: s.t, reason: "health critically low", in_min: 1.5 });
  if (edge(s, "severe_hypo", s.core_temp < cfg.severeHypoC, s.core_temp > cfg.severeHypoC + 1))
    wake.push({ t: s.t, reason: "severe hypothermia onset", in_min: 1.5 });
  if (s.prev_fire > 0.2 && env.fire_warmth < 0.05 && E < 12)
    wake.push({ t: s.t, reason: "fire out in the cold", in_min: 2 });
  s.prev_fire = env.fire_warmth;

  s.t += dt;
  const lastH = s.history[s.history.length - 1];
  if (!lastH || s.t - lastH.t >= cfg.historyEveryMin - 1e-9) {
    s.history.push(sample(s));
    if (s.history.length > 96) s.history.shift();
  }
  if (s.health <= 0) die(s, ev, cfg);
}

function sample(s: BodyState): HistorySample {
  return {
    t: s.t,
    health: s.health,
    satiety: s.satiety,
    energy_reserve: s.energy_reserve,
    hydration: s.hydration,
    core_temp: s.core_temp,
    stamina: s.stamina,
  };
}

const fmtT = (t: number) =>
  `day ${Math.floor(t / 1440) + 1} ${String(Math.floor((t % 1440) / 60)).padStart(2, "0")}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

function die(s: BodyState, ev: ReflexEvent[], cfg: BodyConfig): void {
  s.health = 0;
  s.alive = false;
  let cause: DeathCause = "injury";
  let best = -1;
  for (const k of ALL_CAUSES) {
    if (s.ledger[k] > best) {
      best = s.ledger[k];
      cause = k;
    }
  }
  s.cause_of_death = cause;
  const labels: Record<string, string> = {
    satiety_empty: "stomach ran empty",
    reserve_empty: "energy reserve ran out",
    hydration_empty: "hydration reached zero",
    hypothermia: "core temperature fell below the hypothermia line",
    hyperthermia: "core temperature rose above the heatstroke line",
    wound: "first wound taken",
    infection: "a wound became infected",
    illness_food_poisoning: "food poisoning began",
    illness_fever: "fever began",
    illness_cold: "a cold set in",
    illness_infection: "infection took hold",
  };
  const chain = Object.entries(s.marks)
    .sort((a, b) => a[1] - b[1])
    .map(([k, t]) => `${fmtT(t)}: ${labels[k] ?? k}`);
  chain.push(`${fmtT(s.t)}: health reached zero; the largest recent drain was ${cause}`);
  const final: Record<string, number> = {
    satiety: s.satiety,
    energy_reserve: s.energy_reserve,
    hydration: s.hydration,
    core_temp: s.core_temp,
    stamina: s.stamina,
    immune: s.immune,
    wounds: s.wounds.length,
  };
  pushEvent(s, ev, { t: s.t, kind: "death", detail: `died of ${cause}`, data: { cause } });
  const report: DeathReport = {
    cause,
    died_at_min: s.t,
    died_at_iso: isoAt(s, s.t),
    contributions: { ...s.ledger },
    chain,
    final_vitals: final,
    timeline: s.history.slice(-48),
    events: s.timeline.slice(-60),
  };
  s.death_report = report;
  void cfg;
}

export interface AdvanceOptions {
  /** Internal substep in minutes (default fine = 1). Coarse catch-up uses config.coarseSubstepMin. */
  substepMin?: number;
  /** Stop early after a substep when this returns true (e.g. a sleeper should wake). */
  stopWhen?: (s: BodyState) => boolean;
}

/** Coarse stepping is only used while nothing lethal is ramping; ramps/thresholds are integrated finely. */
function needsFineStep(s: BodyState, cfg: BodyConfig): boolean {
  return (
    s.health < 60 ||
    s.t < s.micro_sleep_until ||
    s.t < s.unconscious_until ||
    s.sleep_pressure >= cfg.microSleepPressure - 0.03 ||
    s.stamina <= cfg.microSleepStamina + 3 ||
    s.hydration < cfg.dehydrationRamp * 2 ||
    (s.satiety <= 0 && s.energy_reserve < cfg.starvationRamp * 2) ||
    s.core_temp < cfg.hypothermiaBelowC + 0.5 ||
    s.core_temp > cfg.heatstrokeAboveC - 0.5
  );
}

/** Advance the body by `minutes` under constant env/activity. Immutable: returns a new state. */
export function advanceBody(
  state: BodyState,
  env: BodyEnvironment,
  activity: Activity,
  minutes: number,
  cfg: BodyConfig = DEFAULT_BODY_CONFIG,
  opts: AdvanceOptions = {},
): StepResult {
  const s = structuredClone(state);
  const events: ReflexEvent[] = [];
  const wake: WakeRequest[] = [];
  let remaining = minutes;
  const base = opts.substepMin ?? cfg.fineSubstepMin;
  while (remaining > 1e-9 && s.alive) {
    const sub = needsFineStep(s, cfg) ? cfg.fineSubstepMin : base;
    const dt = Math.min(sub, remaining);
    stepOnce(s, env, activity, dt, cfg, events, wake);
    remaining -= dt;
    if (opts.stopWhen?.(s)) break;
  }
  return { state: s, events, wake };
}

/** Long-gap catch-up (hibernation / engine downtime): coarse substeps, same dynamics. */
export function catchUp(
  state: BodyState,
  env: BodyEnvironment,
  activity: Activity,
  minutes: number,
  cfg: BodyConfig = DEFAULT_BODY_CONFIG,
): StepResult {
  return advanceBody(state, env, activity, minutes, cfg, { substepMin: cfg.coarseSubstepMin });
}

/** Reasons a sleeper wakes before the planned end (early-wake thresholds). */
export function wakeReason(s: BodyState, cfg: BodyConfig = DEFAULT_BODY_CONFIG): string | null {
  if (!s.alive) return null;
  if (s.t < s.unconscious_until) return null;
  if (painOf(s, cfg) > 0.6) return "pain";
  if (s.core_temp < cfg.severeHypoC + 0.5) return "cold";
  if (s.core_temp > 38.8) return "heat";
  if (s.hydration < 3) return "dry";
  if (s.health < cfg.lowHealthWake) return "weak";
  if (s.shiver > 0.8) return "shivering";
  return null;
}

/** Vitals for spectators only (contract-compatible BodyState subset plus ISO stamps). */
export function vitals(s: BodyState): Record<string, unknown> {
  return {
    health: s.health,
    satiety: s.satiety,
    energy_reserve: s.energy_reserve,
    hydration: s.hydration,
    core_temp: s.core_temp,
    skin_temp: s.skin_temp,
    wetness: s.wetness,
    stamina: s.stamina,
    sleep_pressure: s.sleep_pressure,
    immune: s.immune,
    wounds: s.wounds.map((w) => ({
      id: w.id,
      type: w.type,
      location: w.location,
      severity: w.severity,
      infected: w.infected,
      treated: w.treated,
    })),
    conditions: s.conditions.map((c) => ({ name: c.name, severity: c.severity, since: c.since })),
    alive: s.alive,
    cause_of_death: s.cause_of_death,
  };
}

/** Body signals handed to the organism (numbers, hidden; organism converts them to sensations). */
export function bodySignals(s: BodyState, cfg: BodyConfig = DEFAULT_BODY_CONFIG): BodySignals {
  return {
    health: s.health,
    satiety: s.satiety,
    energy_reserve: s.energy_reserve,
    hydration: s.hydration,
    core_temp: s.core_temp,
    wetness: s.wetness,
    stamina: s.stamina,
    sleep_pressure: s.sleep_pressure,
    pain: painOf(s, cfg),
    shiver: s.shiver,
    sweat: s.sweat,
    fever: s.conditions.find((c) => c.name === "fever")?.severity ?? 0,
    nausea: s.conditions.find((c) => c.name === "food_poisoning")?.severity ?? 0,
    illness: s.conditions.reduce((m, c) => Math.max(m, c.severity), 0),
    asleep: s.asleep,
    wounds: s.wounds.map((w) => ({ type: w.type, location: w.location, severity: w.severity })),
  };
}
export type { BodySignals };

/**
 * Adapt the contracts `Environment` (world engine) to the body's environment. The world already applies
 * shelter to ambient temperature, wind and wetness, so `shelter` is 0 here (no double counting) and fire
 * heat (degrees C) maps onto the config fire gain.
 */
export function bodyEnvironmentFromWorld(
  env: WorldEnvironmentLike,
  cfg: BodyConfig = DEFAULT_BODY_CONFIG,
): BodyEnvironment {
  return {
    ambient_temp_c: env.ambient_temp_c,
    wind: env.wind,
    rain: env.wetness_rate,
    daylight: env.daylight,
    shelter: 0,
    fire_warmth: Math.max(0, env.fire_heat_c / cfg.fireWarmC),
  };
}
