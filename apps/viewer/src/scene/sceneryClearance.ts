import type { Event } from "@truman/contracts";
import {
  dist,
  nearestOnSegment,
  walkableTrailSegments,
  WORLD_CONFIG,
  type Vec,
  type WorldMap,
} from "@truman/world";

export interface SceneryFootprint extends Vec {
  radius: number;
}

type WalkSegment = readonly [Vec, Vec];

export function sceneryCorridors(
  map: WorldMap,
  pose: Vec,
  events: readonly Event[],
): WalkSegment[] {
  const segments: WalkSegment[] = [...walkableTrailSegments(map), [pose, pose]];
  for (const event of events) {
    if (event.kind !== "walk") continue;
    const { waypoints } = event.data;
    for (let index = 1; index < waypoints.length; index++) {
      segments.push([waypoints[index - 1]!, waypoints[index]!]);
    }
  }
  return segments;
}

export function intersectsSceneryCorridor(
  footprint: SceneryFootprint,
  segments: readonly WalkSegment[],
): boolean {
  const clearance = footprint.radius + WORLD_CONFIG.walk.radius;
  return segments.some(([a, b]) => dist(footprint, nearestOnSegment(footprint, a, b)) <= clearance);
}
