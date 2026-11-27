// Path planning on the waypoint graph, walk durations and timelines.
import { WORLD_CONFIG, type WorldConfig } from "./config";
import { dist, insideCabin, nearestOnSegment, type WorldMap } from "./map";
import type { Vec } from "./types";
import {
  escapePoints,
  hitsWalkObstacle,
  obstacleCorners,
  walkObstacles,
  type WalkObstacle,
} from "./walkGeometry";

export interface WalkPlan {
  points: Vec[]; // start .. destination
  reached: boolean;
  distance: number; // metres
  minutes: number;
  speed: number; // m/s actually used
}

interface Navigation {
  obstacles: WalkObstacle[];
  anchors: Record<string, Vec>;
  edges: WeakMap<Vec, WeakMap<Vec, Vec[] | null>>;
}

const navigationCache = new WeakMap<WorldMap, Navigation>();
const blocked = (obstacles: readonly WalkObstacle[], a: Vec, b = a): boolean =>
  obstacles.some((o) => hitsWalkObstacle(o, a, b));
const withinWorld = (map: WorldMap, p: Vec): boolean => Math.hypot(p.x, p.z) <= map.radius;

function navigationFor(map: WorldMap, cfg: WorldConfig): Navigation {
  const cached = cfg === WORLD_CONFIG ? navigationCache.get(map) : undefined;
  if (cached) return cached;
  const obstacles = walkObstacles(map, cfg);
  const anchors: Record<string, Vec> = {};
  for (const [id, p] of Object.entries(map.waypoints)) {
    if (!blocked(obstacles, p)) {
      anchors[id] = p;
      continue;
    }
    const toward = id === "spring" ? (map.waypoints["clearing"] ?? p) : { x: 0, z: 0 };
    const stands = standPoints(map, obstacles, p, toward, cfg.reach, 0, cfg);
    const nearest = stands.find((q) => insideCabin(map, p) === insideCabin(map, q));
    if (nearest) anchors[id] = nearest;
  }
  const nav: Navigation = { obstacles, anchors, edges: new WeakMap() };
  if (cfg === WORLD_CONFIG) navigationCache.set(map, nav);
  return nav;
}

function nearestWaypoint(anchors: Record<string, Vec>, p: Vec): string {
  let best = "cabin_center";
  let bd = Infinity;
  for (const [id, q] of Object.entries(anchors)) {
    const d = dist(p, q);
    if (d < bd) {
      bd = d;
      best = id;
    }
  }
  return best;
}

function dijkstra(map: WorldMap, anchors: Record<string, Vec>, from: string, to: string): string[] {
  const d: Record<string, number> = { [from]: 0 };
  const prev: Record<string, string> = {};
  const todo = new Set(Object.keys(anchors));
  while (todo.size) {
    let u: string | null = null;
    for (const id of todo)
      if (d[id] !== undefined && (u === null || (d[id] as number) < (d[u] as number))) u = id;
    if (u === null) break;
    todo.delete(u);
    if (u === to) break;
    for (const v of map.edges[u] ?? []) {
      if (!anchors[v]) continue;
      const nd = (d[u] as number) + dist(anchors[u] as Vec, anchors[v] as Vec);
      if (d[v] === undefined || nd < (d[v] as number)) {
        d[v] = nd;
        prev[v] = u;
      }
    }
  }
  const path = [to];
  while (path[0] !== from) {
    const p = prev[path[0] as string];
    if (p === undefined) return [];
    path.unshift(p);
  }
  return path;
}

/** Find the nearest valid way out when an old position is already inside a footprint. */
function egress(
  map: WorldMap,
  obstacles: WalkObstacle[],
  from: Vec,
  toward: Vec,
  cfg: WorldConfig,
): Vec | undefined {
  const containing = obstacles.filter((o) => hitsWalkObstacle(o, from, from));
  if (containing.length === 0) return from;
  const surrounding = obstacles.filter((o) => !containing.includes(o));
  return containing
    .flatMap((o) => escapePoints(o, from, toward, cfg))
    .filter(
      (p) =>
        withinWorld(map, p) &&
        insideCabin(map, p) === insideCabin(map, from) &&
        !blocked(obstacles, p) &&
        !blocked(surrounding, from, p),
    )
    .sort((a, b) => dist(from, a) - dist(from, b) || dist(toward, a) - dist(toward, b))[0];
}

/** Recover an older saved position from a solid footprint, staying on the same side of the cabin wall. */
export function recoverWalkPosition(
  map: WorldMap,
  from: Vec,
  cfg: WorldConfig = WORLD_CONFIG,
): Vec | undefined {
  if (!withinWorld(map, from)) return undefined;
  return egress(map, navigationFor(map, cfg).obstacles, from, from, cfg);
}

/** Test both ends and the entire segment using the Resident's collision radius. */
export function clearWalkSegment(
  map: WorldMap,
  from: Vec,
  to: Vec,
  cfg: WorldConfig = WORLD_CONFIG,
): boolean {
  return (
    withinWorld(map, from) &&
    withinWorld(map, to) &&
    !blocked(navigationFor(map, cfg).obstacles, from, to)
  );
}

/** Search visible corners within a bounded margin around an obstructed segment. */
function detour(
  map: WorldMap,
  obstacles: WalkObstacle[],
  from: Vec,
  to: Vec,
  cfg: WorldConfig,
): Vec[] | null {
  if (!blocked(obstacles, from, to)) return [from, to];
  for (const margin of cfg.walk.detourMargins) {
    const nearby = obstacles.filter((o) => {
      const extent = o.kind === "circle" ? o.radius : Math.hypot(o.half.x, o.half.z);
      return dist(o.center, nearestOnSegment(o.center, from, to)) <= margin + extent;
    });
    const corners = nearby
      .flatMap((o) => obstacleCorners(o, cfg))
      .filter((p) => withinWorld(map, p) && !blocked(obstacles, p));
    const points = [from, to, ...corners];
    const scores = new Array<number>(points.length).fill(Infinity);
    const parent = new Array<number>(points.length).fill(-1);
    const visited = new Set<number>();
    scores[0] = 0;
    while (true) {
      let best = -1;
      let bestTotal = Infinity;
      for (const [i, p] of points.entries()) {
        const total = scores[i]! + dist(p, to);
        if (!visited.has(i) && total < bestTotal) {
          best = i;
          bestTotal = total;
        }
      }
      if (best === -1) break;
      if (best === 1) {
        const route = [];
        for (let i = 1; i !== -1; i = parent[i]!) route.push(points[i]!);
        return route.reverse();
      }
      visited.add(best);
      const current = points[best]!;
      for (const [i, p] of points.entries()) {
        if (visited.has(i)) continue;
        const next = scores[best]! + dist(current, p);
        if (next >= scores[i]! || blocked(obstacles, current, p)) continue;
        scores[i] = next;
        parent[i] = best;
      }
    }
  }
  return null;
}

function edgeRoute(
  map: WorldMap,
  nav: Navigation,
  from: Vec,
  to: Vec,
  cfg: WorldConfig,
): Vec[] | null {
  // The same trail takes the same detour in both directions and across processes.
  if (from.x > to.x || (from.x === to.x && from.z > to.z))
    return edgeRoute(map, nav, to, from, cfg)?.slice().reverse() ?? null;
  let routes = nav.edges.get(from);
  if (!routes) {
    routes = new WeakMap();
    nav.edges.set(from, routes);
  }
  const cached = routes.get(to);
  if (cached !== undefined) return cached;
  const route = detour(map, nav.obstacles, from, to, cfg);
  routes.set(to, route);
  return route;
}

function walkResult(points: Vec[], reached: boolean, speed: number): WalkPlan {
  let distance = 0;
  const distinct = points.filter((p, i) => {
    if (i === 0) return true;
    const d = dist(p, points[i - 1]!);
    distance += d;
    return d > 1e-6;
  });
  return { points: distinct, reached, distance, speed, minutes: distance / speed / 60 };
}

/** Plan a walk from `from` to a waypoint id, a station, or an exact raw position. */
export function planWalk(
  map: WorldMap,
  from: Vec,
  to: string | Vec,
  opts: { speedFactor?: number; direct?: boolean } = {},
  cfg: WorldConfig = WORLD_CONFIG,
): WalkPlan {
  const speed = cfg.walk.speed * (opts.speedFactor ?? 1);
  const nav = navigationFor(map, cfg);
  const dest = typeof to === "string" ? nav.anchors[to] : to;
  if (!dest || !withinWorld(map, dest) || blocked(nav.obstacles, dest))
    return walkResult([from], false, speed);
  const start = egress(map, nav.obstacles, from, dest, cfg);
  if (!start) return walkResult([from], false, speed);
  if (dist(start, dest) <= 1e-6) return walkResult([from, dest], true, speed);
  if (!opts.direct) {
    const a = nearestWaypoint(nav.anchors, start);
    const b = typeof to === "string" ? to : nearestWaypoint(nav.anchors, dest);
    const route = dijkstra(map, nav.anchors, a, b);
    if (route.length > 0) {
      const stops = [start, ...route.map((id) => nav.anchors[id]!), dest];
      const points: Vec[] = [from, start];
      for (let i = 1; i < stops.length; i++) {
        const segment = edgeRoute(map, nav, stops[i - 1]!, stops[i]!, cfg);
        if (!segment) break;
        points.push(...segment.slice(1));
        if (i === stops.length - 1) return walkResult(points, true, speed);
      }
    }
  }
  const route = detour(map, nav.obstacles, start, dest, cfg);
  return route ? walkResult([from, ...route], true, speed) : walkResult([from], false, speed);
}

function standPoints(
  map: WorldMap,
  obstacles: WalkObstacle[],
  target: Vec,
  toward: Vec,
  reach: number,
  minDistance: number,
  cfg: WorldConfig,
): Vec[] {
  const surrounding = obstacles.filter((o) => !hitsWalkObstacle(o, target, target));
  const containing = obstacles.filter((o) => hitsWalkObstacle(o, target, target));
  const { cornerCount, detourPad } = cfg.walk;
  const angle = Math.atan2(toward.z - target.z, toward.x - target.x);
  const candidates = [target, ...containing.flatMap((o) => escapePoints(o, target, toward, cfg))];
  for (const r of new Set([minDistance + detourPad, (minDistance + reach) / 2, reach])) {
    for (let i = 0; i < cornerCount; i++) {
      const theta = angle + (2 * Math.PI * i) / cornerCount;
      candidates.push({ x: target.x + Math.cos(theta) * r, z: target.z + Math.sin(theta) * r });
    }
  }
  return candidates
    .filter((p) => {
      const d = dist(target, p);
      return (
        d >= minDistance &&
        d <= reach &&
        withinWorld(map, p) &&
        !blocked(obstacles, p) &&
        !blocked(surrounding, p, target)
      );
    })
    .sort((a, b) => dist(target, a) - dist(target, b) || dist(toward, a) - dist(toward, b))
    .map(({ x, z }) => ({ x, z }));
}

/** Walk as needed to a clear position in reach of a resource, without walking into it. */
export function planWalkNear(
  map: WorldMap,
  from: Vec,
  target: Vec,
  reach: number,
  cfg: WorldConfig,
  minDistance = 0,
): WalkPlan {
  const { obstacles } = navigationFor(map, cfg);
  const d = dist(from, target);
  if (
    d <= reach &&
    d >= minDistance &&
    !blocked(obstacles, from) &&
    !obstacles.some(
      (o) => !hitsWalkObstacle(o, target, target) && hitsWalkObstacle(o, from, target),
    )
  )
    return walkResult([from], true, cfg.walk.speed);
  for (const stand of standPoints(map, obstacles, target, from, reach, minDistance, cfg)) {
    const walk = planWalk(
      map,
      from,
      stand,
      { direct: insideCabin(map, from) === insideCabin(map, stand) },
      cfg,
    );
    if (walk.reached) return walk;
  }
  return walkResult([from], false, cfg.walk.speed);
}

/** Authoritative trail segments so the viewer can keep purely decorative scenery clear. */
export function walkableTrailSegments(
  map: WorldMap,
  cfg: WorldConfig = WORLD_CONFIG,
): Array<[Vec, Vec]> {
  const nav = navigationFor(map, cfg);
  const segments: Array<[Vec, Vec]> = [];
  for (const [id, links] of Object.entries(map.edges)) {
    const from = nav.anchors[id];
    if (!from) continue;
    for (const other of links) {
      const to = nav.anchors[other];
      if (!to || other <= id) continue;
      const path = edgeRoute(map, nav, from, to, cfg);
      if (!path) continue;
      for (let i = 1; i < path.length; i++) segments.push([path[i - 1]!, path[i]!]);
    }
  }
  return segments;
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
