import { dist, WORLD_CONFIG } from "@truman/world";
import { expect, test } from "vitest";
import { stubTools } from "../tools";
import { executeAction } from "./engine";
import { genesis } from "./state";

test("published wood gathering first walks clear of a persisted tree-centered pose", async () => {
  const m = genesis(2489842540, Date.parse("2026-11-26T19:30:00Z"));
  const tree = m.world.nodes.find((node) => node.id === "tree_17")!;
  m.pos = { x: tree.x, z: tree.z, heading: 0 };
  m.station = null;
  const { mind, out } = await executeAction(
    m,
    {
      type: "gather",
      target: "wood",
      minutes: 10,
      thought: "Wood.",
      intent: "Take some wood.",
      expectation: "I can take some.",
    },
    stubTools,
    { menu: new Set(["gather"]), search: false, fetch: false },
  );
  expect(out.ok).toBe(true);
  const walk = out.viewer.find((event) => event.kind === "walk")!;
  const work = out.viewer.find((event) => event.kind === "gather")!;
  expect(walk.data.waypoints).toEqual([
    { x: tree.x, z: tree.z },
    { x: mind.pos.x, z: mind.pos.z },
  ]);
  expect(dist(mind.pos, tree)).toBeGreaterThan(
    WORLD_CONFIG.map.treeTrunkRadius + WORLD_CONFIG.walk.radius,
  );
  expect(walk.t_end).toBe(work.t_start);
  expect(Date.parse(walk.t_end)).toBeGreaterThan(Date.parse(walk.t_start));
  expect(Date.parse(work.t_end)).toBeGreaterThan(Date.parse(work.t_start));
});
