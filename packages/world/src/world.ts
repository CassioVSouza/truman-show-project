// World state, time advance (catch-up == minute stepping) and the environment at a location.
import type { Environment } from "@truman/contracts";
import { ambientTempOutside, daylightAt, seasonAt, timeOfDay, weatherAt } from "./climate";
import {
  NODE_DEFS,
  STARTER_WOODPILE_LOGS,
  WORLD_CONFIG,
  ITEM_DEFS,
  type WorldConfig,
} from "./config";
import { burn, burnRate, fireHeat, fireState } from "./fire";
import { nextHourT } from "./items";
import { dist, generateMap, insideCabin, nearestOnPolyline, type WorldMap } from "./map";
import { regrowStep, seedNodes } from "./resources";
import type { Fire, Vec, WorldState } from "./types";

export function createWorld(
  seed: number,
  opts: { genesisClock?: number } = {},
  cfg: WorldConfig = WORLD_CONFIG,
): WorldState {
  const map = generateMap(seed, cfg);
  const nodes = seedNodes(map.nodes, cfg).map((n) =>
    n.kind === "woodpile" ? { ...n, amount: STARTER_WOODPILE_LOGS, cap: STARTER_WOODPILE_LOGS } : n,
  );
  const hearth: Fire = {
    id: 0,
    x: map.hearth.x,
    z: map.hearth.z,
    fuel: 0,
    indoors: true,
    litAt: 0,
    outAt: null,
    hearth: true,
  };
  return {
    v: 1,
    seed,
    t: 0,
    genesisClock: opts.genesisClock ?? cfg.genesisClockMinute,
    cabinIntegrity: 1,
    nodes,
    fires: [hearth],
    nextFireId: 1,
  };
}

export const mapOf = (w: WorldState, cfg: WorldConfig = WORLD_CONFIG): WorldMap =>
  generateMap(w.seed, cfg);

/**
 * Advance the world to minute `toT`. Work happens at clock-hour boundaries (regrowth, shelter wear,
 * fire pruning) and fire fuel burns between them, so one big jump equals stepping minute by minute.
 * Cost is O(hours * nodes): about 700 node updates per simulated day.
 */
export function advance(w: WorldState, toT: number, cfg: WorldConfig = WORLD_CONFIG): WorldState {
  if (toT <= w.t) return w;
  let { nodes, fires, cabinIntegrity } = w;
  let cursor = w.t;
  while (cursor < toT) {
    const nextH = nextHourT(w, cursor);
    const segEnd = Math.min(nextH, toT);
    if (fires.some((f) => f.fuel > 0)) {
      const wx = weatherAt(w, cursor, cfg);
      const wet = wx.kind === "rain" || wx.kind === "snow";
      const from = cursor;
      fires = fires.map((f) => burn(f, from, segEnd, burnRate(f, wx.precip, wet, cfg)));
    }
    cursor = segEnd;
    if (cursor === nextH) {
      nodes = regrowStep(nodes, w, cursor, cfg);
      const wx = weatherAt(w, cursor - 1, cfg);
      const s = cfg.shelter;
      cabinIntegrity = Math.max(
        s.integrityFloor,
        cabinIntegrity - s.integrityDecayPerHour * (1 + wx.wind + wx.precip),
      );
      const keepFrom = cursor - cfg.fire.pruneAfterHours * 60;
      if (fires.some((f) => !f.hearth && f.outAt !== null && f.outAt < keepFrom)) {
        fires = fires.filter((f) => f.hearth || f.outAt === null || f.outAt >= keepFrom);
      }
    }
  }
  return { ...w, t: toT, nodes, fires, cabinIntegrity };
}

export function shelterAt(
  w: WorldState,
  p: Vec,
  cfg: WorldConfig = WORLD_CONFIG,
): { kind: "open" | "canopy" | "cabin"; quality: number } {
  const map = mapOf(w, cfg);
  const s = cfg.shelter;
  if (insideCabin(map, p)) return { kind: "cabin", quality: s.cabinQuality * w.cabinIntegrity };
  for (const n of w.nodes) {
    if (n.kind === "tree" && dist(n, p) <= s.canopyRadius)
      return { kind: "canopy", quality: s.canopyQuality };
  }
  return { kind: "open", quality: 0 };
}

/** Everything the body engine needs to know about the Resident's surroundings. */
export function environmentAt(w: WorldState, p: Vec, cfg: WorldConfig = WORLD_CONFIG): Environment {
  const map = mapOf(w, cfg);
  const wx = weatherAt(w, w.t, cfg);
  const out = ambientTempOutside(w, w.t, cfg);
  const sh = shelterAt(w, p, cfg);
  const precip = wx.kind === "rain" || wx.kind === "snow" ? wx.precip : 0;
  let ambient = out;
  if (sh.kind === "cabin") {
    ambient = out + (cfg.temp.cabinMean - out) * cfg.temp.cabinBuffer * w.cabinIntegrity;
  }
  const fh = fireHeat(w.fires, p, w.t, cfg);
  let heat = fh.heat;
  if (sh.kind === "cabin") {
    for (const f of w.fires) {
      if (f.indoors) heat += cfg.fire.roomHeat * cfg.fire.stateFactor[fireState(f, w.t, cfg)];
    }
  }
  const damp = wx.kind === "fog" ? 0.1 : 0;
  const near = cfg.nearRadius;
  const foodNear = w.nodes.some(
    (n) =>
      n.amount >= 1 &&
      n.kind !== "fish_shoal" &&
      ITEM_DEFS[NODE_DEFS[n.kind].item]?.kind === "food" &&
      dist(n, p) <= near,
  );
  const riverD = dist(p, nearestOnPolyline(p, map.river)) - map.riverWidth / 2;
  return {
    t: Math.floor(w.t),
    time_of_day: timeOfDay(w, w.t, cfg),
    season: seasonAt(w.t, cfg),
    weather: wx.kind,
    daylight: daylightAt(w, w.t, cfg),
    ambient_temp_c: ambient,
    fire_heat_c: heat,
    fire_adjacent: fh.adjacent,
    wind: wx.wind * (1 - 0.9 * sh.quality),
    wetness_rate: Math.max(precip * (1 - sh.quality), damp * (1 - sh.quality)),
    shelter: sh.kind,
    shelter_quality: sh.quality,
    food_near: foodNear,
    water_clean_near: dist(p, map.spring) <= near,
    water_risky_near: riverD <= near || dist(p, map.pool) - map.pool.radius <= near,
  };
}
