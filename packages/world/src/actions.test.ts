import { describe, expect, test } from "vitest";
import {
  drink,
  eat,
  fillJar,
  gather,
  makeFire,
  boilWater,
  cook,
  tendFire,
  moveTo,
  repairShelter,
  wear,
  restHeading,
  restSpot,
  fish,
  useItem,
} from "./actions";
import type { Actor } from "./actions";
import {
  describeInventory,
  findItem,
  invAdd,
  invCount,
  starterInventory,
  wornInsulation,
  foodEffects,
} from "./items";
import { WORLD_CONFIG } from "./config";
import { dist, generateMap, nearestOnPolyline, nearestOnSegment, polar } from "./map";
import { clearWalkSegment, planWalk, recoverWalkPosition } from "./path";
import type { WorldState } from "./types";
import { hitsWalkObstacle, walkObstacles } from "./walkGeometry";
import { advance, createWorld, environmentAt, walkMapOf } from "./world";

const DAY = 1440;
const skills = {
  foraging: 25,
  fire_making: 25,
  woodcutting: 10,
  drinking_water_safety: 30,
  fishing: 0,
  shelter_warmth: 20,
};
const start = (seed = 11): { w: WorldState; a: Actor } => {
  const w = createWorld(seed);
  const m = generateMap(seed);
  return {
    w,
    a: { pos: { ...m.stations.bed }, inventory: starterInventory(), skills: { ...skills } },
  };
};

describe("starter kit and inventory", () => {
  test("kit has six dried portions and a described list without hidden words", () => {
    const { a } = start();
    expect(invCount(a.inventory, "dried_food")).toBe(6);
    expect(findItem(a.inventory, "the dried food")?.item).toBe("dried_food");
    expect(findItem(a.inventory, "jar")?.item).toBe("water_jar");
    expect(describeInventory(a.inventory)).toContain("six portions of dried food");
    expect(wornInsulation(a.inventory)).toBeCloseTo(0.3);
  });
  test("food effects scale with spoilage; toxic food carries illness chance", () => {
    expect(foodEffects("dried_food", 1)?.satiety).toBe(30);
    expect(foodEffects("dried_food", 0)?.illness_chance).toBeGreaterThan(0.5);
    expect(foodEffects("lookalike_berries", 1)?.illness_chance).toBeGreaterThan(0.5);
    expect(foodEffects("firewood")).toBeNull();
  });
});

describe("move_to", () => {
  test("walks through the door to a station and takes time", () => {
    const { w, a } = start();
    const r = moveTo(w, a, "forest_edge");
    expect(r.ok).toBe(true);
    expect(r.minutes).toBeGreaterThan(0.3);
    expect(r.actor.pos).toEqual(generateMap(11).stations.forest_edge);
    expect(r.walk!.points.length).toBeGreaterThan(3);
  });
});

describe("gather", () => {
  test("gathers firewood from the pile, depleting it", () => {
    const { w, a } = start();
    const m = generateMap(11);
    const near = { ...a, pos: { ...m.stations.door } };
    const r = gather(w, near, "firewood", 10);
    expect(r.ok).toBe(true);
    expect(invCount(r.actor.inventory, "firewood")).toBeGreaterThan(0);
    const before = w.nodes.find((n) => n.kind === "woodpile")!.amount;
    expect(r.world.nodes.find((n) => n.kind === "woodpile")!.amount).toBeLessThan(before);
    expect(r.text).toMatch(/^You gather/);
  });
  test("deterministic: same inputs, same result", () => {
    const { w, a } = start();
    const m = generateMap(11);
    const at = { ...a, pos: { ...m.stations.clearing } };
    expect(gather(w, at, "roots", 30)).toEqual(gather(w, at, "roots", 30));
  });
  test("foraging at the clearing yields food; picked-over nodes yield nothing", () => {
    let { w, a } = start();
    const m = generateMap(11);
    a = { ...a, pos: { ...m.stations.clearing } };
    const r = gather(w, a, "roots", 60);
    expect(r.ok).toBe(true);
    expect(invCount(r.actor.inventory, "roots")).toBeGreaterThanOrEqual(1);
    w = { ...w, nodes: w.nodes.map((n) => (n.kind === "root_patch" ? { ...n, amount: 0 } : n)) };
    const r2 = gather(w, a, "roots", 60);
    expect(r2.ok).toBe(false);
    expect(gather(w, a, "gibberish").ok).toBe(false);
  });
  test("look-alike berries: unskilled picker gets toxic ones, skilled picker often avoids", () => {
    const { w, a } = start();
    const bush = w.nodes.find((n) => n.kind === "berry_bush" && n.lookalike)!;
    const w2 = {
      ...w,
      nodes: w.nodes.map((n) =>
        n.id === bush.id ? n : n.kind === "berry_bush" ? { ...n, amount: 0 } : n,
      ),
    };
    const at = { ...a, pos: { x: bush.x, z: bush.z } };
    const low = gather(w2, { ...at, skills: { foraging: 0 } }, "berries", 30);
    expect(low.facts.item).toBe("lookalike_berries");
    let avoided = 0;
    for (let i = 0; i < 40; i++) {
      const r = gather({ ...w2, t: i * 7 }, { ...at, skills: { foraging: 100 } }, "berries", 30);
      if (r.facts.avoided) avoided++;
    }
    expect(avoided).toBeGreaterThan(20);
  });
  test("fishing barehanded and unskilled almost never works", () => {
    const { w, a } = start();
    const m = generateMap(11);
    const sh = w.nodes.find((n) => n.kind === "fish_shoal")!;
    const r = fish(w, { ...a, pos: { x: sh.x, z: sh.z } }, 30);
    expect(r.world.nodes.find((n) => n.id === sh.id)!.amount).toBeGreaterThan(sh.amount - 3);
    expect(m.river.length).toBeGreaterThan(2);
  });
});

describe("water", () => {
  test("jar is clean; river water is risky, spring is clean; boiling cleans the jar", () => {
    const { w, a: a0 } = start();
    let a = a0;
    const m = generateMap(11);
    const jarDrink = drink(w, a, "water from the jar");
    expect(jarDrink.facts.contamination).toBe(0);
    expect(jarDrink.facts.hydration).toBeGreaterThan(0);
    const river = drink(w, { ...a, pos: { ...m.stations.river } }, "river");
    expect(river.ok).toBe(true);
    expect(Number(river.facts.contamination)).toBeGreaterThan(0.2);
    const spring = drink(w, { ...a, pos: { x: m.spring.x + 1, z: m.spring.z } }, "spring");
    expect(spring.facts.contamination).toBe(0);
    expect(drink(w, { ...a, pos: { x: m.spring.x + 150, z: m.spring.z } }, "the river").ok).toBe(
      false,
    );

    // empty the jar, refill from the river, boil
    a = { ...a, pos: { ...m.stations.river } };
    const f = fillJar(w, a, "river");
    expect(f.ok).toBe(true);
    const drunk = drink(w, f.actor, "jar");
    expect(Number(drunk.facts.contamination)).toBeGreaterThan(0.2);
    const via = useItem(w, a, "jar", "river");
    expect(via.ok).toBe(true);
  });
  test("jar drains with drinks and then reports empty", () => {
    const { w, a } = start();
    let cur = a;
    for (let i = 0; i < 6; i++) cur = drink(w, cur, "jar").actor;
    const r = drink(w, cur, "jar");
    expect(r.ok).toBe(false);
  });
});

describe("eat", () => {
  test("eating consumes one portion and reports body facts", () => {
    const { w, a } = start();
    const r = eat(w, a, "dried food");
    expect(r.ok).toBe(true);
    expect(invCount(r.actor.inventory, "dried_food")).toBe(5);
    expect(Number(r.facts.satiety)).toBeGreaterThan(20);
    expect(eat(w, a, "firewood").ok).toBe(false);
    expect(eat(w, a, "a unicorn").ok).toBe(false);
  });
});

describe("fire", () => {
  const withWood = (a: Actor, n: number): Actor => ({
    ...a,
    inventory: invAdd(a.inventory, "firewood", n),
  });
  test("hearth fire: needs wood, can fail, consumes tinder, warms the cabin, burns out", () => {
    const { w, a } = start();
    const m = generateMap(11);
    const at = withWood({ ...a, pos: { x: m.hearth.x - 0.8, z: m.hearth.z } }, 6);
    expect(makeFire(w, { ...at, inventory: starterInventory() }).ok).toBe(false); // no wood
    let lit: WorldState | null = null;
    let actor = at;
    let attempts = 0;
    let cur = w;
    while (!lit && attempts < 4) {
      const r = makeFire(cur, actor);
      actor = r.actor;
      cur = { ...r.world, t: r.world.t + 15 };
      if (r.ok) lit = cur;
      attempts++;
    }
    expect(lit).not.toBeNull();
    expect(invCount(actor.inventory, "tinder")).toBeLessThan(4);
    expect(environmentAt(lit!, a.pos).fire_heat_c).toBeGreaterThan(3);
    // already burning
    expect(makeFire(lit!, actor).ok).toBe(false);
    // tend adds fuel
    const before = lit!.fires[0]!.fuel;
    const t = tendFire(lit!, actor);
    expect(t.world.fires[0]!.fuel).toBe(Math.min(600, before + 60));
    // eventually out
    const out = advance(lit!, lit!.t + 1000);
    expect(out.fires[0]!.fuel).toBe(0);
  });
  test("fire making in rain is less likely than in dry weather (statistical)", () => {
    const { w, a } = start();
    const base = { ...a, pos: { x: 30, z: 30 }, inventory: invAdd(a.inventory, "firewood", 4) };
    let wet = 0;
    let dry = 0;
    const raining: WorldState = { ...w, seed: 1 };
    // find a t where it rains and one where it is dry
    let tRain = -1;
    let tDry = -1;
    for (let t = 0; t < 40 * DAY && (tRain < 0 || tDry < 0); t += 360) {
      const e = environmentAt({ ...raining, t }, base.pos);
      if (e.weather === "rain" && e.wetness_rate > 0.7 && tRain < 0) tRain = t;
      if (e.weather === "clear" && tDry < 0) tDry = t;
    }
    expect(tRain).toBeGreaterThanOrEqual(0);
    for (let i = 0; i < 200; i++) {
      if (
        makeFire(
          { ...raining, t: tRain + i },
          { ...base, inventory: invAdd(base.inventory, "tinder", i % 7) },
        ).ok
      )
        wet++;
      if (
        makeFire(
          { ...raining, t: tDry + i },
          { ...base, inventory: invAdd(base.inventory, "tinder", i % 7) },
        ).ok
      )
        dry++;
    }
    expect(dry).toBeGreaterThan(wet);
  });
  test("needs unobstructed dry ground and places a campfire beside the Resident", () => {
    const { w, a } = start(2489842540);
    const map = generateMap(w.seed);
    const tree = w.nodes.find((n) => n.id === "tree_17")!;
    const overlap = { x: tree.x, z: tree.z };
    const blocked = makeFire(w, withWood({ ...a, pos: overlap }, 4));
    expect(blocked.ok).toBe(false);
    expect(blocked.text).toContain("clear, dry ground");
    expect(blocked.world).toBe(w);
    const wetGround = makeFire(w, withWood({ ...a, pos: map.pool }, 4));
    expect(wetGround.ok).toBe(false);
    expect(wetGround.world).toBe(w);

    const pos = recoverWalkPosition(walkMapOf(w), overlap)!;
    const ready = withWood({ ...a, pos, skills: { fire_making: 100 } }, 4);
    const attempts = Array.from({ length: 16 }, (_, t) => makeFire({ ...w, t }, ready));
    const result = attempts.find((r) => r.ok)!;
    const fire = result.world.fires.find((f) => !f.hearth)!;
    const { campRadius, campTreeClearance } = WORLD_CONFIG.fire;
    expect(result.text).toContain("on the clear ground beside you");
    expect(result.actor.pos).toEqual(pos);
    expect(dist(pos, fire)).toBeGreaterThan(campRadius + WORLD_CONFIG.walk.radius);
    expect(dist(pos, fire)).toBeLessThanOrEqual(WORLD_CONFIG.reach);
    expect(dist(tree, fire)).toBeGreaterThan(campTreeClearance);
    expect(dist(map.pool, fire)).toBeGreaterThan(map.pool.radius + campRadius);
    expect(dist(nearestOnPolyline(fire, map.river), fire)).toBeGreaterThan(
      map.riverWidth / 2 + campRadius,
    );
    expect(
      walkObstacles(map, WORLD_CONFIG, campRadius).some((o) => hitsWalkObstacle(o, fire, fire)),
    ).toBe(false);
  });

  test("a burning hearth cannot be tended or felt outside the cabin wall", () => {
    const { w, a } = start();
    const burning = { ...w, fires: [{ ...w.fires[0]!, fuel: 60 }] };
    const outside = { x: 3.2, z: 0.7 };
    expect(tendFire(burning, withWood({ ...a, pos: outside }, 2)).ok).toBe(false);
    expect(environmentAt(burning, outside).fire_heat_c).toBe(0);
  });

  test("the doorstep stays clear and a campfire farther into the yard leaves the entrance passable", () => {
    const { w, a } = start(1);
    const map = generateMap(w.seed);
    const doorstep = { x: 0, z: 2.11 };
    const actor = withWood({ ...a, pos: doorstep, skills: { fire_making: 100 } }, 10);
    const blocked = makeFire(w, actor);
    expect(blocked.text).toContain("clear, dry ground");
    expect(blocked.world).toBe(w);
    const result = makeFire(w, { ...actor, pos: { x: 0, z: 3.5 } });
    expect(result.ok, result.text).toBe(true);
    const withFire = walkMapOf(result.world);
    const yard = map.waypoints["yard"]!;
    expect(clearWalkSegment(withFire, map.stations.door, yard)).toBe(true);
    const entry = planWalk(withFire, yard, "bed");
    expect(entry.reached).toBe(true);
    expect(planWalk(withFire, entry.points.at(-1)!, "yard").reached).toBe(true);
  });

  test("boil water and cook need fire and pot", () => {
    const { w, a } = start();
    const m = generateMap(11);
    const r0 = boilWater(w, a);
    expect(r0.ok).toBe(false);
    const fire = { ...w, fires: [{ ...w.fires[0]!, fuel: 200, litAt: -100 }] };
    const at: Actor = { ...a, pos: { x: m.hearth.x - 0.8, z: m.hearth.z } };
    // jar clean -> nothing to do
    expect(boilWater(fire, at).ok).toBe(false);
    const dirty = {
      ...at,
      inventory: at.inventory.map((s) =>
        s.item === "water_jar" ? { ...s, props: { fill: 4, quality: "river" } } : s,
      ),
    };
    const b = boilWater(fire, dirty);
    expect(b.ok).toBe(true);
    expect(drink(fire, b.actor, "jar").facts.contamination).toBe(0);
    const withRoots = { ...at, inventory: invAdd(at.inventory, "roots", 2) };
    const c = cook(fire, withRoots, "roots");
    expect(c.ok).toBe(true);
    expect(invCount(c.actor.inventory, "cooked_roots")).toBe(1);
    expect(cook(fire, at, "dried food").ok).toBe(false);
    expect(cook(w, withRoots, "roots").ok).toBe(false);
    const almostOut = { ...fire, fires: [{ ...fire.fires[0]!, fuel: 1 }] };
    expect(cook(almostOut, withRoots, "roots").world.fires[0]).toMatchObject({
      fuel: 0,
      outAt: w.t,
    });
  });
});

describe("wear, shelter, rest", () => {
  test("resting near the live tree finds a lying direction that clears the trunk", () => {
    const w = createWorld(2489842540);
    const tree = w.nodes.find((n) => n.id === "tree_17")!;
    const overlap = { x: tree.x, z: tree.z };
    expect(restSpot(w, overlap)).toMatchObject({ shelter: "canopy", clear: false });
    expect(restHeading(w, { ...overlap, heading: 0 })).toBeUndefined();
    const p = recoverWalkPosition(walkMapOf(w), overlap)!;
    const facingTree = Math.atan2(tree.x - p.x, tree.z - p.z);
    const heading = restHeading(w, { ...p, heading: facingTree });
    expect(heading).toBeDefined();
    expect(heading).not.toBe(facingTree);
    expect(restSpot(w, p)).toMatchObject({ shelter: "canopy", clear: true, on_bed: false });
    const axis = polar(heading!, WORLD_CONFIG.shelter.restHalfLength);
    const head = { x: p.x - axis.x, z: p.z - axis.z };
    const feet = { x: p.x + axis.x, z: p.z + axis.z };
    expect(dist(tree, nearestOnSegment(tree, head, feet))).toBeGreaterThan(
      WORLD_CONFIG.map.treeTrunkRadius + WORLD_CONFIG.walk.radius,
    );
    const { bed } = generateMap(w.seed).stations;
    const bedside = recoverWalkPosition(walkMapOf(w), bed)!;
    expect(restSpot(w, bedside)).toMatchObject({ shelter: "cabin", clear: true, on_bed: true });
    expect(restSpot(w, { x: 3.15, z: bed.z }).on_bed).toBe(false);
  });
  test("wearing the blanket raises insulation; removing lowers it", () => {
    const { w, a } = start();
    const on = wear(w, a, "blanket");
    expect(on.ok).toBe(true);
    expect(wornInsulation(on.actor.inventory)).toBeGreaterThan(0.6);
    const off = wear(w, on.actor, "blanket", true);
    expect(wornInsulation(off.actor.inventory)).toBeCloseTo(0.3);
    expect(wear(w, a, "knife").ok).toBe(false);
  });
  test("repair raises integrity and uses wood; rest spots differ", () => {
    const { w, a } = start();
    const worn = { ...w, cabinIntegrity: 0.5 };
    const a2 = { ...a, inventory: invAdd(a.inventory, "firewood", 2) };
    const r = repairShelter(worn, a2);
    expect(r.ok).toBe(true);
    expect(r.world.cabinIntegrity).toBeGreaterThan(0.5);
    expect(invCount(r.actor.inventory, "firewood")).toBe(1);
    expect(repairShelter(w, a2).ok).toBe(false);
    const m = generateMap(11);
    expect(restSpot(w, m.stations.bed)).toMatchObject({ shelter: "cabin", on_bed: true });
    expect(restSpot(w, m.stations.clearing).shelter).toBe("open");
    const tree = w.nodes.find((n) => n.kind === "tree")!;
    expect(restSpot(w, { x: tree.x + 1, z: tree.z }).shelter).toBe("canopy");
  });
});
