// Path planning on the waypoint graph, walk durations and timelines.
import { WORLD_CONFIG, type WorldConfig } from "./config";
import { dist, type WorldMap } from "./map";
import type { Vec } from "./types";

export interface WalkPlan {
  points: Vec[]; // start .. destination
  distance: number; // metres
  minutes: number;
  speed: number; // m/s actually used
}

function nearestWaypoint(map: WorldMap, p: Vec): string {
  let best = "cabin_center";
  let bd = Infinity;
  for (const [id, q] of Object.entries(map.waypoints)) {
    const d = dist(p, q);
    if (d < bd) {
      bd = d;
      best = id;
    }
  }
  return best;
}

function dijkstra(map: WorldMap, from: string, to: string): string[] {
  const d: Record<string, number> = { [from]: 0 };
  const prev: Record<string, string> = {};
  const todo = new Set(Object.keys(map.waypoints));
  while (todo.size) {
    let u: string | null = null;
    for (const id of todo)
      if (d[id] !== undefined && (u === null || (d[id] as number) < (d[u] as number))) u = id;
    if (u === null) break;
    todo.delete(u);
    if (u === to) break;
    for (const v of map.edges[u] ?? []) {
      const nd = (d[u] as number) + dist(map.waypoints[u] as Vec, map.waypoints[v] as Vec);
      if (d[v] === undefined || nd < (d[v] as number)) {
        d[v] = nd;
        prev[v] = u;
      }
    }
  }
  const path = [to];
  while (path[0] !== from) {
    const p = prev[path[0] as string];
    if (p === undefined) return [from, to];
    path.unshift(p);
  }
  return path;
}

/** Plan a walk from `from` to a waypoint id, a station, or a raw position. */
export function planWalk(
  map: WorldMap,
  from: Vec,
  to: string | Vec,
  opts: { speedFactor?: number; direct?: boolean } = {},
  cfg: WorldConfig = WORLD_CONFIG,
): WalkPlan {
  const dest: Vec = typeof to === "string" ? (map.waypoints[to] ?? from) : to;
  let points: Vec[];
  if (opts.direct) {
    points = [from, dest];
  } else {
    const a = nearestWaypoint(map, from);
    const b = typeof to === "string" && map.waypoints[to] ? to : nearestWaypoint(map, dest);
    const route = dijkstra(map, a, b).map((id) => map.waypoints[id] as Vec);
    points = [from, ...route];
    if (typeof to !== "string" || !map.waypoints[to]) points.push(dest);
    // drop duplicate consecutive points
    points = points.filter((p, i) => i === 0 || dist(p, points[i - 1] as Vec) > 1e-6);
    if (points.length < 2) points = [from, dest];
  }
  let distance = 0;
  for (let i = 1; i < points.length; i++) distance += dist(points[i - 1] as Vec, points[i] as Vec);
  const speed = cfg.walk.speed * (opts.speedFactor ?? 1);
  return { points, distance, speed, minutes: distance / speed / 60 };
}

/** Time-stamped samples along a plan, for the viewer's walk event (t in minutes from tStart). */
export function walkTimeline(
  plan: WalkPlan,
  tStart: number,
): { t: number; x: number; z: number }[] {
  const out: { t: number; x: number; z: number }[] = [];
  let acc = 0;
  for (let i = 0; i < plan.points.length; i++) {
    const p = plan.points[i] as Vec;
    if (i > 0) acc += dist(plan.points[i - 1] as Vec, p);
    out.push({ t: tStart + acc / plan.speed / 60, x: p.x, z: p.z });
  }
  return out;
}

/** Position at time t (minutes since tStart) along the plan. */
export function positionAlong(plan: WalkPlan, minutesElapsed: number): Vec {
  let left = minutesElapsed * 60 * plan.speed;
  for (let i = 1; i < plan.points.length; i++) {
    const a = plan.points[i - 1] as Vec;
    const b = plan.points[i] as Vec;
    const l = dist(a, b);
    if (left <= l) {
      const f = l === 0 ? 0 : left / l;
      return { x: a.x + (b.x - a.x) * f, z: a.z + (b.z - a.z) * f };
    }
    left -= l;
  }
  return plan.points[plan.points.length - 1] as Vec;
}
