// Horizontal footprints, expanded by the Resident's walking radius.
import type { WorldConfig } from "./config";
import { dist, nearestOnSegment, type WorldMap } from "./map";
import type { Vec } from "./types";

type Box = { kind: "box"; center: Vec; half: Vec };
type Circle = { kind: "circle"; center: Vec; radius: number };
export type WalkObstacle = Box | Circle;

export function walkObstacles(map: WorldMap, cfg: WorldConfig): WalkObstacle[] {
  const { radius, nodeRadii, hearthRadius, springRadius, cabin } = cfg.walk;
  const { halfW, halfD } = map.cabin;
  const t = cabin.wallHalfThickness;
  const frontHalf = (halfW - cabin.doorHalfOpening) / 2;
  const frontX = halfW - frontHalf;
  const box = (center: Vec, x: number, z: number): Box => ({
    kind: "box",
    center,
    half: { x: x + radius, z: z + radius },
  });
  const circle = (center: Vec, r: number): Circle => ({
    kind: "circle",
    center,
    radius: r + radius,
  });
  const out: WalkObstacle[] = [
    box({ x: 0, z: -halfD }, halfW, t),
    box({ x: -halfW, z: 0 }, t, halfD),
    box({ x: halfW, z: 0 }, t, halfD),
    box({ x: -frontX, z: halfD }, frontHalf, t),
    box({ x: frontX, z: halfD }, frontHalf, t),
    box(map.stations.bed, cabin.furniture.bed.x, cabin.furniture.bed.z),
    box(map.stations.desk, cabin.furniture.desk.x, cabin.furniture.desk.z),
    box(
      map.stations.journal_table,
      cabin.furniture.journal_table.x,
      cabin.furniture.journal_table.z,
    ),
    circle(map.hearth, hearthRadius),
    circle(map.spring, springRadius),
  ];
  for (const node of map.nodes) {
    const r = node.kind === "tree" ? cfg.map.treeTrunkRadius : nodeRadii[node.kind];
    if (r !== undefined) out.push(circle(node, r));
  }
  return out;
}

/** Intersect the whole segment with a closed, expanded footprint. */
export function hitsWalkObstacle(o: WalkObstacle, a: Vec, b: Vec): boolean {
  const x = o.kind === "circle" ? o.radius : o.half.x;
  const z = o.kind === "circle" ? o.radius : o.half.z;
  const minX = o.center.x - x;
  const maxX = o.center.x + x;
  const minZ = o.center.z - z;
  const maxZ = o.center.z + z;
  if (
    Math.max(a.x, b.x) < minX ||
    Math.min(a.x, b.x) > maxX ||
    Math.max(a.z, b.z) < minZ ||
    Math.min(a.z, b.z) > maxZ
  )
    return false;
  if (o.kind === "circle") return dist(o.center, nearestOnSegment(o.center, a, b)) <= o.radius;

  // Clip the segment's parameter interval to each pair of parallel sides.
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const tx1 = dx === 0 ? -Infinity : (minX - a.x) / dx;
  const tx2 = dx === 0 ? Infinity : (maxX - a.x) / dx;
  const tz1 = dz === 0 ? -Infinity : (minZ - a.z) / dz;
  const tz2 = dz === 0 ? Infinity : (maxZ - a.z) / dz;
  return (
    Math.max(0, Math.min(tx1, tx2), Math.min(tz1, tz2)) <=
    Math.min(1, Math.max(tx1, tx2), Math.max(tz1, tz2))
  );
}

export function obstacleCorners(o: WalkObstacle, cfg: WorldConfig): Vec[] {
  const { detourPad, cornerCount } = cfg.walk;
  const { x, z } = o.center;
  if (o.kind === "box") {
    const dx = o.half.x + detourPad;
    const dz = o.half.z + detourPad;
    return [
      { x: x - dx, z: z - dz },
      { x: x - dx, z: z + dz },
      { x: x + dx, z: z - dz },
      { x: x + dx, z: z + dz },
    ];
  }
  // Circumscribe the circle so chords between neighboring corners also clear it.
  const r = (o.radius + detourPad) / Math.cos(Math.PI / cornerCount);
  return Array.from({ length: cornerCount }, (_, i) => {
    const theta = (2 * Math.PI * i) / cornerCount;
    return { x: x + Math.cos(theta) * r, z: z + Math.sin(theta) * r };
  });
}

export function escapePoints(o: WalkObstacle, from: Vec, toward: Vec, cfg: WorldConfig): Vec[] {
  const p = cfg.walk.detourPad;
  const { x, z } = o.center;
  if (o.kind === "box") {
    return [
      { x: x - o.half.x - p, z: from.z },
      { x: x + o.half.x + p, z: from.z },
      { x: from.x, z: z - o.half.z - p },
      { x: from.x, z: z + o.half.z + p },
    ];
  }
  const p0 = dist(o.center, from) > 0 ? from : toward;
  const angle = Math.atan2(p0.z - z, p0.x - x);
  return [
    { x: x + Math.cos(angle) * (o.radius + p), z: z + Math.sin(angle) * (o.radius + p) },
    ...obstacleCorners(o, cfg),
  ];
}
