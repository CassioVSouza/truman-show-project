import { describe, expect, test } from "vitest";
import { Environment } from "@truman/contracts";
import { WORLD_CONFIG } from "./config";
import { fireState } from "./fire";
import { advanceInventory, starterInventory } from "./items";
import { generateMap, insideCabin } from "./map";
import { planWalk, positionAlong, walkTimeline } from "./path";
import type { Fire, WorldState } from "./types";
import { advance, createWorld, environmentAt, fireTimeline } from "./world";

const DAY = 1440;
const lit = (w: WorldState, outdoors = false): WorldState => {
  if (outdoors) {
    const f: Fire = {
      id: 5,
      x: 20,
      z: 20,
      fuel: 800,
      indoors: false,
      litAt: 0,
      outAt: null,
      hearth: false,
    };
    return { ...w, fires: [...w.fires, f], nextFireId: 6 };
  }
  return { ...w, fires: [{ ...(w.fires[0] as Fire), fuel: 300 }] };
};

function norm(w: WorldState) {
  return {
    ...w,
    fires: w.fires.map((f) => ({ ...f, outAt: f.outAt === null ? null : Math.round(f.outAt) })),
  };
}

describe("map", () => {
  test("deterministic per seed, different across seeds, all stations reachable", () => {
    const a = generateMap(7);
    const b = generateMap(7, { ...WORLD_CONFIG });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(JSON.stringify(generateMap(8))).not.toBe(JSON.stringify(a));
    for (const s of Object.keys(a.stations)) {
      const plan = planWalk(a, { x: 0, z: 0 }, s);
      expect(plan.points.length).toBeGreaterThanOrEqual(2);
    }
    expect(insideCabin(a, a.stations.bed)).toBe(true);
    expect(insideCabin(a, a.stations.forest_edge)).toBe(false);
    expect(a.nodes.length).toBeGreaterThan(40);
    for (const n of a.nodes) expect(Math.hypot(n.x, n.z)).toBeLessThan(a.radius);
  });
  test("walk plans have sane durations and timelines", () => {
    const m = generateMap(7);
    const plan = planWalk(m, m.stations.bed, "forest_edge");
    expect(plan.minutes).toBeGreaterThan(0.2);
    expect(plan.minutes).toBeLessThan(10);
    const tl = walkTimeline(plan, 100);
    expect(tl[0]?.t).toBe(100);
    expect(tl[tl.length - 1]?.t).toBeCloseTo(100 + plan.minutes);
    expect(positionAlong(plan, plan.minutes + 1)).toEqual(plan.points[plan.points.length - 1]);
    expect(planWalk(m, m.stations.bed, "forest_edge")).toEqual(plan);
  });
});

describe("world advance", () => {
  test("catch-up equals minute-by-minute stepping (14 days, fires, weather)", () => {
    const w0 = lit(createWorld(11), true);
    const target = 14 * DAY + 37;
    const big = advance(w0, target);
    let step = w0;
    for (let t = 1; t <= target; t++) step = advance(step, t);
    expect(norm(step)).toEqual(norm(big));
    let chunk = w0;
    for (let t = 0; t < target;) {
      t = Math.min(target, t + 733);
      chunk = advance(chunk, t);
    }
    expect(norm(chunk)).toEqual(norm(big));
  });
  test("catch-up equals stepping with a depleted world and a hearth fire", () => {
    let w0 = lit(createWorld(5));
    w0 = { ...w0, nodes: w0.nodes.map((n, i) => (i % 3 === 0 ? { ...n, amount: 0 } : n)) };
    const target = 3 * DAY + 5;
    let step = w0;
    for (let t = 1; t <= target; t++) step = advance(step, t);
    expect(norm(step)).toEqual(norm(advance(w0, target)));
  });
  test("inventory spoilage catch-up equals stepping", () => {
    const w = createWorld(3);
    const inv = starterInventory();
    const end = 5 * DAY + 11;
    const big = advanceInventory(inv, w, 0, end);
    let step = inv;
    for (let t = 1; t <= end; t++) step = advanceInventory(step, w, t - 1, t);
    expect(step).toEqual(big);
    expect(big.find((s) => s.item === "fruit")?.condition ?? 1).toBeLessThan(0.95);
    expect(big.find((s) => s.item === "dried_food")?.condition ?? 0).toBeGreaterThan(0.95);
  });
  test("fire burns down: burning -> dying -> out", () => {
    let w = lit(createWorld(11));
    const f = () => w.fires[0] as Fire;
    expect(fireState(f(), 100)).toBe("burning");
    w = advance(w, 290);
    expect(fireState(f(), w.t)).toBe("dying");
    w = advance(w, 400);
    expect(fireState(f(), w.t)).toBe("out");
    expect(f().outAt).toBeCloseTo(300, 2);
  });
  test("fire timeline gives exact visual transitions and matches weather-driven burn-out", () => {
    const indoors = lit(createWorld(11));
    expect(fireTimeline(indoors, 400).map(({ t, state }) => ({ t, state }))).toEqual([
      { t: 10, state: "burning" },
      { t: 280, state: "dying" },
      { t: 300, state: "out" },
    ]);
    const outdoors = lit(createWorld(1), true);
    const final = advance(outdoors, 810);
    const changes = fireTimeline(outdoors, 810);
    expect(changes.at(-1)).toMatchObject({ state: "out", t: final.fires[1]!.outAt });
    expect(changes.filter((x) => x.state === "out")).toHaveLength(1);
    expect(changes.at(-1)!.t).toBeLessThan(800);
  });
  test("gentle start: nodes begin at 1.5x and settle to capacity", () => {
    const w = createWorld(11);
    const tree = w.nodes.find((n) => n.kind === "tree")!;
    const sum = (x: WorldState) =>
      x.nodes.filter((n) => n.kind === "tree").reduce((a, n) => a + n.amount, 0);
    expect(tree.amount).toBeCloseTo(tree.cap * 1.5);
    expect(sum(advance(w, 30 * DAY))).toBeCloseTo(sum(w) / 1.5, 0);
  });
  test("depleted node regrows", () => {
    let w = createWorld(11);
    const root = w.nodes.find((n) => n.kind === "root_patch")!;
    w = { ...w, nodes: w.nodes.map((n) => (n.id === root.id ? { ...n, amount: 0 } : n)) };
    w = advance(w, 10 * DAY);
    expect(w.nodes.find((n) => n.id === root.id)!.amount).toBeGreaterThan(1);
  });
  test("berries vanish in winter", () => {
    const w = advance(createWorld(11), 40 * DAY);
    expect(
      w.nodes.filter((n) => n.kind === "berry_bush").reduce((a, n) => a + n.amount, 0),
    ).toBeLessThan(1);
  });
  test("woodpile is finite and does not regrow", () => {
    const w = advance(createWorld(11), 5 * DAY);
    expect(w.nodes.find((n) => n.kind === "woodpile")!.amount).toBe(10);
  });
});

describe("environment", () => {
  test("validates against the contract; shelter and fire change it", () => {
    let w = createWorld(11);
    const m = generateMap(11);
    const inside = environmentAt(w, m.stations.bed);
    const outside = environmentAt(w, m.stations.clearing);
    expect(() => Environment.parse(inside)).not.toThrow();
    expect(() => Environment.parse(outside)).not.toThrow();
    expect(inside.shelter).toBe("cabin");
    expect(outside.shelter).toBe("open");
    expect(inside.wind).toBeLessThan(outside.wind + 1e-9);
    w = lit(w);
    const warm = environmentAt(w, m.stations.bed);
    expect(warm.fire_heat_c).toBeGreaterThan(inside.fire_heat_c + 5);
    expect(environmentAt(w, { x: m.spring.x + 1, z: m.spring.z }).water_clean_near).toBe(true);
    expect(environmentAt(w, m.stations.river).water_risky_near).toBe(true);
  });
});
