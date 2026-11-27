import type { Event, ReplaySnapshot, Snapshot } from "@truman/contracts";
import {
  dist,
  nearestOnSegment,
  walkableTrailSegments,
  WORLD_CONFIG,
  type Vec,
  type WorldMap,
} from "@truman/world";
import { evaluateTimeline, snapshotAt } from "../state/timeline";
import { restPose } from "./restPose";

export interface SceneryFootprint extends Vec {
  radius: number;
}

type SceneryCorridor = readonly [Vec, Vec, number?];

export function sceneryCorridors(
  map: WorldMap,
  snapshot: Snapshot,
  events: readonly Event[],
  anchors: readonly ReplaySnapshot[] = [],
): SceneryCorridor[] {
  const { pose } = snapshot.resident;
  const segments: SceneryCorridor[] = [...walkableTrailSegments(map), [pose, pose]];
  const campRadius = WORLD_CONFIG.fire.campRadius;
  const replayStart = anchors[0] ? Date.parse(anchors[0].generated_at) : -Infinity;
  for (const fire of snapshot.world.entities) {
    if (fire.type === "fire") segments.push([fire, fire, campRadius]);
  }
  for (const event of events) {
    if (event.kind === "walk") {
      const { waypoints } = event.data;
      for (let index = 1; index < waypoints.length; index++) {
        segments.push([waypoints[index - 1]!, waypoints[index]!]);
      }
    } else if (event.kind === "fire") {
      segments.push([event.data, event.data, campRadius]);
    } else if (
      event.kind === "sleep_start" ||
      (event.kind === "anim" && event.data.name === "rest")
    ) {
      if (Date.parse(event.t_end) < replayStart) continue;
      const atMs = Math.max(replayStart, Date.parse(event.t_start));
      const state = evaluateTimeline(snapshotAt(snapshot, anchors, atMs), events, atMs);
      const { x, z, heading, onBed } = restPose(map, state);
      if (onBed) continue;
      const dx = Math.sin(heading) * WORLD_CONFIG.shelter.restHalfLength;
      const dz = Math.cos(heading) * WORLD_CONFIG.shelter.restHalfLength;
      segments.push([
        { x: x - dx, z: z - dz },
        { x: x + dx, z: z + dz },
      ]);
    }
  }
  return segments;
}

export function intersectsSceneryCorridor(
  footprint: SceneryFootprint,
  segments: readonly SceneryCorridor[],
): boolean {
  return segments.some(
    ([a, b, radius = WORLD_CONFIG.walk.radius]) =>
      dist(footprint, nearestOnSegment(footprint, a, b)) <= footprint.radius + radius,
  );
}
