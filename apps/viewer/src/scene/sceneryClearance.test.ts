import { SCHEMA_VERSION, type Event } from "@truman/contracts";
import { generateMap, walkableTrailSegments } from "@truman/world";
import { describe, expect, it } from "vitest";
import { intersectsSceneryCorridor, sceneryCorridors } from "./sceneryClearance";

describe("scenery corridors", () => {
  const map = generateMap(104729);

  it("keeps a full trail segment clear of scenery between its endpoints", () => {
    const trail = walkableTrailSegments(map).find(([a, b]) => Math.hypot(a.x - b.x, a.z - b.z) > 8);
    expect(trail).toBeDefined();
    const [a, b] = trail!;
    const corridors = sceneryCorridors(map, map.stations.door, []);
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
    const corridors = sceneryCorridors(map, { x: 90, z: 90 }, [recordedWalk]);
    expect(intersectsSceneryCorridor({ x: 75, z: 70.8, radius: 0.6 }, corridors)).toBe(true);
    expect(intersectsSceneryCorridor({ x: 80, z: 75, radius: 0.6 }, corridors)).toBe(true);
    expect(intersectsSceneryCorridor({ x: 90, z: 90, radius: 0.6 }, corridors)).toBe(true);
    expect(intersectsSceneryCorridor({ x: 75, z: 75, radius: 0.6 }, corridors)).toBe(false);
  });
});
