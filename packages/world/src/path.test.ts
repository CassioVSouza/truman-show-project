import { describe, expect, test } from "vitest";
import { drink, fillJar, gather, moveTo } from "./actions";
import { WORLD_CONFIG } from "./config";
import { starterInventory } from "./items";
import { dist, generateMap, nearestOnSegment } from "./map";
import { planWalk, walkableTrailSegments } from "./path";
import type { ResourceNode, Vec } from "./types";
import { createWorld } from "./world";
import { hitsWalkObstacle, walkObstacles } from "./walkGeometry";

const liveSeed = 2489842540;
const cfg = WORLD_CONFIG;
const actorAt = (pos: Vec) => ({ pos, inventory: starterInventory(), skills: {} });

describe("obstacle-aware walking", () => {
  test("detours around the full footprints of trunks, rocks, and logs", () => {
    const nodes: ResourceNode[] = ["tree", "fruit_tree", "stone_outcrop", "deadwood"].map(
      (kind, i) => ({
        id: `${kind}_${i}`,
        kind: kind as ResourceNode["kind"],
        x: 45 + 4 * i,
        z: 10,
        cap: 1,
        amount: 1,
        lookalike: false,
      }),
    );
    const map = { ...generateMap(7), nodes };
    const from = { x: 42, z: 10 };
    const to = { x: 60, z: 10 };
    const plan = planWalk(map, from, to, { direct: true });
    expect(plan.reached).toBe(true);
    expect(plan.distance).toBeGreaterThan(dist(from, to));
    expect(plan.points.at(-1)).toEqual(to);
    expect(planWalk(map, from, to, { direct: true })).toEqual(plan);
    for (let i = 1; i < plan.points.length; i++) {
      for (const node of nodes) {
        const radius =
          node.kind === "tree" ? cfg.map.treeTrunkRadius : cfg.walk.nodeRadii[node.kind]!;
        const closest = nearestOnSegment(node, plan.points[i - 1]!, plan.points[i]!);
        expect(dist(node, closest)).toBeGreaterThan(radius + cfg.walk.radius);
      }
    }
    const blocked = planWalk(map, from, nodes[0]!, { direct: true });
    expect(blocked).toMatchObject({ reached: false, points: [from], distance: 0 });
  });

  test("uses the doorway and ends alongside the bed for interaction", () => {
    const map = generateMap(7);
    const from = { x: 0, z: -4 };
    const plan = planWalk(map, from, "bed", { direct: true });
    expect(plan.reached).toBe(true);
    const end = plan.points.at(-1)!;
    expect(dist(end, map.stations.bed)).toBeLessThan(1.5);
    expect(end).not.toEqual(map.stations.bed);
    const doorway = { x: 0, z: map.cabin.halfD };
    const obstacles = walkObstacles(map, cfg);
    expect(
      plan.points
        .slice(1)
        .some((p, i) => dist(doorway, nearestOnSegment(doorway, plan.points[i]!, p)) < 0.11),
    ).toBe(true);
    for (let i = 1; i < plan.points.length; i++) {
      expect(obstacles.some((o) => hitsWalkObstacle(o, plan.points[i - 1]!, plan.points[i]!))).toBe(
        false,
      );
    }
  });

  test("generated station trails remain clear and usable on the live map", () => {
    const map = generateMap(liveSeed);
    const obstacles = walkObstacles(map, cfg);
    for (const [from, to] of walkableTrailSegments(map)) {
      expect(obstacles.some((o) => hitsWalkObstacle(o, from, to))).toBe(false);
    }
    const w = createWorld(liveSeed);
    for (const station of [
      "bed",
      "desk",
      "journal_table",
      "window",
      "river",
      "spring",
      "forest_edge",
      "mirror_pool",
    ] as const) {
      const result = moveTo(w, actorAt(map.stations.clearing), station);
      expect(result.ok, station).toBe(true);
      expect(dist(result.actor.pos, map.waypoints[station]!)).toBeLessThanOrEqual(cfg.reach);
    }
  });

  test("keeps outdoor routes reachable across map seeds", () => {
    for (let seed = 1; seed <= 12; seed++) {
      const w = createWorld(seed);
      const map = generateMap(seed);
      const actor = actorAt(map.stations.bed);
      for (const id of ["forest_edge", "clearing", "spring", "river", "mirror_pool"] as const) {
        const result = moveTo(w, actor, id);
        expect(result.ok, `${id} (seed ${seed})`).toBe(true);
      }
    }
  });

  test("collects wood next to the live tree and lets an old tree-centered pose escape", () => {
    const w = createWorld(liveSeed);
    const tree = w.nodes.find((n) => n.id === "tree_17")!;
    expect({ x: tree.x, z: tree.z }).toEqual({ x: 4.31, z: -24.19 });
    const persisted = { x: tree.x, z: tree.z };
    const result = gather(w, actorAt(persisted), "wood", 10);
    expect(result.ok).toBe(true);
    expect(result.facts.node).toBe(tree.id);
    expect(result.walk?.points[0]).toEqual(persisted);
    expect(result.walk?.points.at(-1)).toEqual(result.actor.pos);
    const distance = dist(result.actor.pos, tree);
    expect(distance).toBeGreaterThan(cfg.map.treeTrunkRadius + cfg.walk.radius);
    expect(distance).toBeLessThanOrEqual(cfg.reach);
    const noTravel = gather(w, result.actor, "wood", 10);
    expect(noTravel.walk?.distance).toBe(0);
    expect(noTravel.actor.pos).toEqual(result.actor.pos);
  });

  test("reaches the raised spring basin on foot and refills from the same spot", () => {
    const w = createWorld(liveSeed);
    const { spring } = generateMap(liveSeed);
    const from = { x: spring.x + 6, z: spring.z };
    const result = drink(w, actorAt(from), "spring");
    expect(result.ok).toBe(true);
    expect(result.walk?.points[0]).toEqual(from);
    expect(result.walk?.points.at(-1)).toEqual(result.actor.pos);
    expect(dist(result.actor.pos, spring)).toBeGreaterThan(cfg.walk.springRadius + cfg.walk.radius);
    expect(dist(result.actor.pos, spring)).toBeLessThanOrEqual(cfg.reach);
    const refill = fillJar(w, result.actor, "spring");
    expect(refill.ok).toBe(true);
    expect(refill.walk?.distance).toBe(0);
    expect(refill.actor.pos).toEqual(result.actor.pos);
  });
});
