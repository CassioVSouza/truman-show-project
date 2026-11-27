import { SCHEMA_VERSION, type Event } from "@truman/contracts";
import { generateMap, walkableTrailSegments } from "@truman/world";
import { describe, expect, it } from "vitest";
import { DEMO_SNAPSHOT } from "../api/demoData";
import { restPose } from "./restPose";
import { intersectsSceneryCorridor, sceneryCorridors } from "./sceneryClearance";

describe("scenery corridors", () => {
  const map = generateMap(104729);
  const snapshot = {
    ...DEMO_SNAPSHOT,
    generated_at: "2026-11-26T19:10:00.000Z",
    resident: { ...DEMO_SNAPSHOT.resident, pose: { x: 90, z: 90, heading: 0 } },
  };

  it("keeps a full trail segment clear of scenery between its endpoints", () => {
    const trail = walkableTrailSegments(map).find(([a, b]) => Math.hypot(a.x - b.x, a.z - b.z) > 8);
    expect(trail).toBeDefined();
    const [a, b] = trail!;
    const corridors = sceneryCorridors(map, snapshot, []);
    expect(
      intersectsSceneryCorridor(
        {
          x: (a.x + b.x) / 2,
          z: (a.z + b.z) / 2,
          radius: 0.5,
        },
        corridors,
      ),
    ).toBe(true);
  });

  it("clears published walk bends and the resident pose without erasing distant scenery", () => {
    const recordedWalk: Event = {
      v: SCHEMA_VERSION,
      seq: 30,
      t_start: "2026-11-26T19:10:00.000Z",
      t_end: "2026-11-26T19:12:00.000Z",
      actor: "resident",
      kind: "walk",
      data: {
        waypoints: [
          { x: 70, z: 70 },
          { x: 80, z: 70 },
          { x: 80, z: 80 },
        ],
        speed: 1.3,
      },
      log_id: 10,
    };
    const corridors = sceneryCorridors(map, snapshot, [recordedWalk]);
    expect(intersectsSceneryCorridor({ x: 75, z: 70.8, radius: 0.6 }, corridors)).toBe(true);
    expect(intersectsSceneryCorridor({ x: 80, z: 75, radius: 0.6 }, corridors)).toBe(true);
    expect(intersectsSceneryCorridor({ x: 90, z: 90, radius: 0.6 }, corridors)).toBe(true);
    expect(intersectsSceneryCorridor({ x: 75, z: 75, radius: 0.6 }, corridors)).toBe(false);
  });

  it("clears both published fire props and the full sleeping pose", () => {
    const fire: Event = {
      v: SCHEMA_VERSION,
      seq: 31,
      t_start: snapshot.generated_at,
      t_end: snapshot.generated_at,
      actor: "world",
      kind: "fire",
      data: { id: "fire_1", state: "lit", x: 80, z: 80 },
      log_id: null,
    };
    const sleep: Event = {
      v: SCHEMA_VERSION,
      seq: 32,
      t_start: snapshot.generated_at,
      t_end: "2026-11-26T19:30:00.000Z",
      actor: "resident",
      kind: "sleep_start",
      data: { heading: Math.PI / 2, on_bed: false },
      log_id: null,
    };
    const corridors = sceneryCorridors(map, snapshot, [fire, sleep]);
    expect(intersectsSceneryCorridor({ x: 80.42, z: 80, radius: 0.01 }, corridors)).toBe(true);
    expect(intersectsSceneryCorridor({ x: 91.05, z: 90, radius: 0.05 }, corridors)).toBe(true);
    expect(intersectsSceneryCorridor({ x: 90, z: 91.05, radius: 0.05 }, corridors)).toBe(false);
  });

  it("uses the cabin mattress only for bed rest in the cabin", () => {
    const bedRest = { station: "bed", restPlacement: { onBed: true } } as const;
    expect(restPose(map, { ...bedRest, pose: snapshot.resident.pose })).toEqual({
      ...snapshot.resident.pose,
      onBed: false,
    });
    expect(restPose(map, { ...bedRest, pose: { x: 1.7, z: -0.28, heading: 1 } })).toEqual({
      ...map.stations.bed,
      heading: 0,
      onBed: true,
    });
  });
});
