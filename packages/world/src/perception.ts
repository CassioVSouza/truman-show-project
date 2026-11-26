// Perception: what the Resident sees, as plain sentences. Never numbers about the body or hidden state.
import { WORLD_CONFIG, type WorldConfig } from "./config";
import { fireState } from "./fire";
import { dist, insideCabin, nearestOnPolyline } from "./map";
import { environmentAt, mapOf } from "./world";
import {
  CABIN_WORDS,
  EDGE_WORDS,
  LIGHT_LINE,
  MIRROR_LINE,
  POOL_WORDS,
  RIVER_WORDS,
  SPRING_WORDS,
  STATION_THING,
  WEATHER_LINE,
  WIND_LINE,
  INDOOR_WEATHER_LINE,
  INDOOR_LIGHT_LINE,
  fireWords,
  nodeWords,
} from "./vocab";
import { weatherAt } from "./climate";
import type { Pose, Vec, WorldState } from "./types";

interface Seen {
  label: string; // singular phrase, also the grouping key
  many: string;
  x: number;
  z: number;
  d: number; // distance to nearest part, metres
  rel: number; // bearing relative to heading, degrees, + = right
}

export interface Perception {
  lines: string[];
  text: string;
  range: number; // metres actually visible (engine use)
}

const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const count = (n: number): string => (n < WORDS.length ? (WORDS[n] as string) : "many");

export function bearingDeg(pose: Pose, p: Vec): number {
  const vx = p.x - pose.x;
  const vz = p.z - pose.z;
  const fx = Math.sin(pose.heading);
  const fz = Math.cos(pose.heading);
  const rx = -Math.cos(pose.heading);
  const rz = Math.sin(pose.heading);
  return (Math.atan2(vx * rx + vz * rz, vx * fx + vz * fz) * 180) / Math.PI;
}

export function directionPhrase(rel: number): string {
  const a = Math.abs(rel);
  const side = rel < 0 ? "left" : "right";
  if (a <= 10) return "straight ahead";
  if (a <= 40) return `ahead, slightly ${side}`;
  if (a <= 80) return `to the ${side}`;
  if (a <= 120) return `far to the ${side}`;
  return "behind you";
}

function distPhrase(d: number): string {
  return d < 1.5 ? "within arm's reach" : `${Math.round(d)} m`;
}

export function visibleRange(
  w: WorldState,
  p: Vec,
  detail = 1,
  cfg: WorldConfig = WORLD_CONFIG,
): number {
  const pc = cfg.perception;
  const env = environmentAt(w, p, cfg);
  if (env.shelter === "cabin") {
    const lamp = env.daylight > 0.15 || env.fire_heat_c > 0;
    return lamp ? pc.cabinRange : pc.closeSense;
  }
  let range = pc.minRange + (pc.baseRange - pc.minRange) * Math.pow(env.daylight, 0.6);
  if (env.weather === "fog") range = Math.min(range, pc.fogRange);
  if (env.weather === "rain" || env.weather === "snow") range *= pc.precipRangeFactor;
  return Math.max(pc.closeSense, range * (0.5 + 0.5 * Math.min(1, Math.max(0, detail))));
}

/**
 * Describe what is in view from `pose`. `detail` (0..1) narrows range and the number of lines
 * (tunnel vision under stress or fatigue); the caller decides it, this module never sees the body.
 */
export function perceive(
  w: WorldState,
  pose: Pose,
  opts: { detail?: number } = {},
  cfg: WorldConfig = WORLD_CONFIG,
): Perception {
  const pc = cfg.perception;
  const detail = Math.min(1, Math.max(0, opts.detail ?? 1));
  const map = mapOf(w, cfg);
  const env = environmentAt(w, pose, cfg);
  const inside = insideCabin(map, pose);
  const range = visibleRange(w, pose, detail, cfg);
  const half = pc.fovDeg / 2;
  const burning = w.fires.filter((f) => fireState(f, w.t, cfg) !== "out");

  const raw: { label: string; many: string; at: Vec; edgeDist?: number }[] = [];
  if (inside) {
    for (const [id, thing] of Object.entries(STATION_THING)) {
      raw.push({ label: thing, many: thing, at: map.stations[id as keyof typeof map.stations] });
    }
    for (const n of w.nodes)
      if (n.kind === "woodpile")
        raw.push({ label: nodeWords(n).one, many: nodeWords(n).many, at: n });
  } else {
    raw.push({
      label: CABIN_WORDS,
      many: CABIN_WORDS,
      at: { x: 0, z: 0 },
      edgeDist: Math.max(0, Math.hypot(pose.x, pose.z) - 2.6),
    });
    for (const n of w.nodes) {
      const wd = nodeWords(n);
      raw.push({ label: wd.one, many: wd.many, at: n });
    }
    const rp = nearestOnPolyline(pose, map.river);
    raw.push({
      label: RIVER_WORDS,
      many: RIVER_WORDS,
      at: rp,
      edgeDist: Math.max(0, dist(pose, rp) - map.riverWidth / 2),
    });
    raw.push({ label: SPRING_WORDS, many: SPRING_WORDS, at: map.spring });
    raw.push({
      label: POOL_WORDS,
      many: POOL_WORDS,
      at: map.pool,
      edgeDist: Math.max(0, dist(pose, map.pool) - map.pool.radius),
    });
    const out = Math.hypot(pose.x, pose.z);
    if (out > 0) {
      const k = map.radius / out;
      raw.push({
        label: EDGE_WORDS,
        many: EDGE_WORDS,
        at: { x: pose.x * k, z: pose.z * k },
        edgeDist: map.radius - out,
      });
    }
  }
  for (const f of w.fires) {
    if (inside !== insideCabin(map, f)) continue;
    const fw = fireWords(fireState(f, w.t, cfg));
    raw.push({ label: fw.one, many: fw.many, at: f });
  }

  const seen: Seen[] = [];
  for (const r of raw) {
    const d = r.edgeDist ?? dist(pose, r.at);
    const rel = bearingDeg(pose, r.at);
    const inView = Math.abs(rel) <= half || d <= pc.closeSense;
    if (!inView) continue;
    const litByFire =
      burning.some((f) => dist(f, r.at) <= pc.fireLightRadius) && d <= pc.fireLitRange;
    if (d > range && !litByFire) continue;
    seen.push({ label: r.label, many: r.many, x: r.at.x, z: r.at.z, d, rel });
  }
  seen.sort((a, b) => a.d - b.d);

  // group identical things in the same general direction
  const groups = new Map<string, Seen[]>();
  for (const s of seen) {
    const side = s.rel < -40 ? "L" : s.rel > 40 ? "R" : "C";
    const key = `${s.label}|${side}`;
    const g = groups.get(key);
    if (g) g.push(s);
    else groups.set(key, [s]);
  }
  const maxLines = Math.max(2, Math.round(pc.maxLines * (0.4 + 0.6 * detail)));
  const objLines: string[] = [];
  for (const g of groups.values()) {
    const first = g[0] as Seen;
    const dir = directionPhrase(first.rel);
    const where = distPhrase(first.d);
    const sentence =
      g.length === 1
        ? `${cap(first.label)}, ${where} ${dir}`
        : `${cap(count(g.length))} ${first.many} ${dir}, the nearest ${distPhrase(first.d)} away`;
    objLines.push(sentence + ".");
  }
  const lines: string[] = [];
  const ambient = ambientLines(w, env, inside, cfg);
  // indoors the room comes first, the outdoors only as seen or heard from inside
  if (inside) lines.push(...objLines.slice(0, maxLines), ...ambient);
  else lines.push(...ambient, ...objLines.slice(0, maxLines));
  return { lines, text: lines.join(" "), range };
}

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

function ambientLines(
  w: WorldState,
  env: ReturnType<typeof environmentAt>,
  inside: boolean,
  cfg: WorldConfig,
): string[] {
  const wx = weatherAt(w, w.t, cfg);
  const out: string[] = [];
  const wline = WEATHER_LINE(wx.kind, wx.precip);
  if (inside) {
    out.push(INDOOR_WEATHER_LINE(wx.kind, wx.precip));
    if (env.time_of_day !== "day") out.push(INDOOR_LIGHT_LINE[env.time_of_day]);
    return out;
  }
  out.push(wline);
  if (wx.wind > 0.6) out.push(WIND_LINE);
  if (env.time_of_day !== "day") out.push(LIGHT_LINE[env.time_of_day]);
  return out;
}

/** Look closely at something. Falls back to a general view when the target is unknown. */
export function lookAt(
  w: WorldState,
  pose: Pose,
  target: string,
  cfg: WorldConfig = WORLD_CONFIG,
): string {
  const map = mapOf(w, cfg);
  const t = target.toLowerCase();
  const env = environmentAt(w, pose, cfg);
  if (
    (t.includes("pool") || t.includes("water") || t.includes("reflect") || t.includes("mirror")) &&
    dist(pose, map.pool) - map.pool.radius <= cfg.perception.mirrorDistance &&
    env.daylight >= cfg.perception.mirrorMinLight
  ) {
    return MIRROR_LINE;
  }
  return perceive(w, pose, {}, cfg).text;
}

/** Coarse occupancy grid around a point: 0 free, 1 blocked, 2 water. Row-major, row = z, col = x. */
export function occupancyGrid(
  w: WorldState,
  centre: Vec,
  cfg: WorldConfig = WORLD_CONFIG,
): { cell: number; size: number; origin: Vec; cells: number[] } {
  const map = mapOf(w, cfg);
  const { cell, half } = cfg.occupancy;
  const size = Math.round((2 * half) / cell);
  const origin = { x: centre.x - half, z: centre.z - half };
  const cells: number[] = [];
  const cb = cfg.map.cabin;
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const p = { x: origin.x + (i + 0.5) * cell, z: origin.z + (j + 0.5) * cell };
      let v = 0;
      if (Math.hypot(p.x, p.z) >= map.radius) v = 1;
      else if (
        dist(p, nearestOnPolyline(p, map.river)) <= map.riverWidth / 2 ||
        dist(p, map.pool) <= map.pool.radius
      )
        v = 2;
      else if (
        Math.abs(p.x) <= cb.halfW + cell / 2 &&
        Math.abs(p.z) <= cb.halfD + cell / 2 &&
        !insideCabin(map, p)
      )
        v = 1;
      else if (
        w.nodes.some((n) => n.kind === "tree" && dist(n, p) <= cell / 2 + cfg.map.treeTrunkRadius)
      )
        v = 1;
      cells.push(v);
    }
  }
  return { cell, size, origin, cells };
}
