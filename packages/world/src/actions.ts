// World effects of survival actions. Each takes the world + actor and returns a new world + actor,
// the minutes it takes, plain text for the Resident, and structured `facts` for the body engine
// (facts never reach the Resident). Deterministic: draws are seeded from (seed, t, context).
import type { Station } from "@truman/contracts";
import { NODE_DEFS, TARGET_WORDS, WORLD_CONFIG, ITEM_DEFS, type WorldConfig } from "./config";
import { nearestFire, useFuel } from "./fire";
import { describeStack, findItem, foodEffects, invAdd, invCount, invRemove } from "./items";
import {
  dist,
  insideCabin,
  nearestOnPolyline,
  nearestOnSegment,
  polar,
  type WorldMap,
} from "./map";
import { clearWalkSegment, planWalk, planWalkNear, type WalkPlan } from "./path";
import { nodeItem } from "./resources";
import { rngFrom, strHash } from "./rng";
import { hitsWalkObstacle, walkObstacles } from "./walkGeometry";
import { mapOf, shelterAt, walkMapOf } from "./world";
import { weatherAt } from "./climate";
import { STATION_PHRASE } from "./vocab";
import type { Fire, Inventory, NodeKind, Pose, ResourceNode, Vec, WorldState } from "./types";

export interface Actor {
  pos: Vec;
  inventory: Inventory;
  skills: Record<string, number>;
}
export type Facts = Record<string, number | string | boolean>;
export interface ActionResult {
  ok: boolean;
  minutes: number;
  text: string;
  world: WorldState;
  actor: Actor;
  facts: Facts;
  walk?: WalkPlan;
}

const sk = (a: Actor, name: string): number =>
  Math.min(100, Math.max(0, a.skills[name] ?? 0)) / 100;
const fail = (
  w: WorldState,
  a: Actor,
  text: string,
  minutes = 1,
  facts: Facts = {},
): ActionResult => ({
  ok: false,
  minutes,
  text,
  world: w,
  actor: a,
  facts,
});
const wetNow = (w: WorldState, cfg: WorldConfig): number => {
  const wx = weatherAt(w, w.t, cfg);
  return wx.kind === "rain" || wx.kind === "snow" ? wx.precip : 0;
};
const setNode = (w: WorldState, n: ResourceNode): WorldState => ({
  ...w,
  nodes: w.nodes.map((x) => (x.id === n.id ? n : x)),
});
const setFire = (w: WorldState, f: Fire): WorldState => ({
  ...w,
  fires: w.fires.map((x) => (x.id === f.id ? f : x)),
});

// ---------------- move ----------------
export function moveTo(
  w: WorldState,
  a: Actor,
  to: Station | "spring",
  opts: { speedFactor?: number } = {},
  cfg: WorldConfig = WORLD_CONFIG,
): ActionResult {
  const map = walkMapOf(w, cfg);
  const plan = planWalk(map, a.pos, to, opts, cfg);
  if (!plan.reached) return fail(w, a, "You cannot find a clear way there.");
  const dest = plan.points[plan.points.length - 1] as Vec;
  const phrase = to === "spring" ? "the spring" : STATION_PHRASE[to];
  return {
    ok: true,
    minutes: Math.max(1, plan.minutes),
    text: `You walk to ${phrase}.`,
    world: w,
    actor: { ...a, pos: dest },
    facts: { distance_m: plan.distance },
    walk: plan,
  };
}

// ---------------- gather / chop / fish ----------------
function kindsFor(target: string): NodeKind[] {
  const t = target.toLowerCase();
  for (const e of TARGET_WORDS) if (e.words.some((x) => t.includes(x))) return e.kinds;
  return [];
}

export function gather(
  w: WorldState,
  a: Actor,
  target: string,
  minutes?: number,
  mode: "gather" | "chop" | "fish" = "gather",
  cfg: WorldConfig = WORLD_CONFIG,
): ActionResult {
  const rc = cfg.resources;
  let kinds = kindsFor(target);
  if (mode === "chop") kinds = ["tree"];
  if (mode === "fish") kinds = ["fish_shoal"];
  if (!kinds.length) return fail(w, a, "You are not sure what you mean to gather there.");
  const mins = Math.min(
    rc.maxGatherMinutes,
    Math.max(rc.minGatherMinutes, Math.round(minutes ?? rc.defaultGatherMinutes)),
  );
  const all = w.nodes.filter(
    (n) => kinds.includes(n.kind) && dist(n, a.pos) <= cfg.gatherSearchRadius,
  );
  const usable = all.filter((n) => n.amount >= 1).sort((p, q) => dist(p, a.pos) - dist(q, a.pos));
  if (!all.length) return fail(w, a, "You look around but find nothing like that close by.", 2);
  if (usable.length === 0)
    return fail(w, a, "What there is here has been picked over; nothing is ready to take.", 3);
  const map = walkMapOf(w, cfg);
  const minimum = mode === "fish" ? map.riverWidth / 2 + 0.5 : 0;
  let chosen: { node: ResourceNode; walk: WalkPlan } | undefined;
  for (const node of usable) {
    const walk = planWalkNear(map, a.pos, node, cfg.reach, cfg, minimum);
    if (!walk.reached) continue;
    chosen = { node, walk };
    break;
  }
  if (!chosen) return fail(w, a, "You cannot find a clear way to reach it.");
  const { node, walk } = chosen;

  const def = NODE_DEFS[node.kind];
  const walkMin = walk.minutes;
  const rng = rngFrom(w.seed, w.t, strHash(node.id), invCount(a.inventory, def.item));
  const skill = sk(a, def.skill);
  const here: Actor = { ...a, pos: walk.points[walk.points.length - 1]! };

  if (node.lookalike && def.lookalikeItem && mode === "gather" && rng() < rc.maxAvoid * skill) {
    return {
      ...fail(
        w,
        here,
        "Something about these looks wrong to you, so you leave them alone.",
        walkMin + 5,
        { avoided: true },
      ),
      walk,
    };
  }

  let rate =
    def.yieldPerMin * (rc.skillYield.min + (rc.skillYield.max - rc.skillYield.min) * skill);
  if (mode === "fish") {
    const hasTool = !!def.needsTool && invCount(a.inventory, def.needsTool) > 0;
    rate =
      (rc.fishBareChance + rc.fishSkillChance * skill * 100) * (hasTool ? rc.fishToolFactor : 1);
  }
  const variance = 1 + (rng() - 0.5) * 2 * rc.yieldVariance;
  const expected = rate * mins * variance;
  let units = Math.floor(expected + rng());
  units = Math.min(units, Math.floor(node.amount));
  if (units <= 0) {
    return {
      ...fail(
        w,
        here,
        mode === "fish"
          ? "You wait and watch the water, but catch nothing."
          : "You search for a while but come away with nothing.",
        walkMin + mins,
        { gathered: 0 },
      ),
      walk,
    };
  }
  const used = Math.min(
    mins,
    Math.max(rc.minGatherMinutes, Math.ceil(units / Math.max(rate, 1e-6))),
  );
  const item = nodeItem(node);
  const inv = invAdd(a.inventory, item, units);
  const world = setNode(w, { ...node, amount: node.amount - units });
  const stack = { item, qty: units };
  const verb = mode === "fish" ? "You catch" : mode === "chop" ? "You cut" : "You gather";
  return {
    ok: true,
    minutes: walkMin + used,
    text: `${verb} ${describeStack(stack)}.`,
    world,
    actor: { ...here, inventory: inv },
    facts: { gathered: units, item, node: node.id, kind: node.kind, work: mode, skill: def.skill },
    walk,
  };
}
export const chop = (
  w: WorldState,
  a: Actor,
  target: string,
  minutes?: number,
  cfg?: WorldConfig,
): ActionResult => gather(w, a, target, minutes, "chop", cfg);
export const fish = (w: WorldState, a: Actor, minutes?: number, cfg?: WorldConfig): ActionResult =>
  gather(w, a, "fish", minutes, "fish", cfg);

// ---------------- water ----------------
type WaterSrc = "spring" | "river" | "pool" | "rain";
const SRC_ILL = (c: WorldConfig): Record<WaterSrc, number> => ({
  spring: 0,
  river: c.water.riverIllness,
  pool: c.water.poolIllness,
  rain: c.water.rainIllness,
});

function waterSource(
  w: WorldState,
  a: Actor,
  text: string,
  cfg: WorldConfig,
): { src: WaterSrc; at: Vec; minDistance: number } | null {
  const map = mapOf(w, cfg);
  const t = text.toLowerCase();
  const options: { src: WaterSrc; at: Vec; d: number }[] = [
    { src: "spring", at: map.spring, d: dist(a.pos, map.spring) },
    {
      src: "river",
      at: nearestOnPolyline(a.pos, map.river),
      d: dist(a.pos, nearestOnPolyline(a.pos, map.river)) - map.riverWidth / 2,
    },
    { src: "pool", at: map.pool, d: dist(a.pos, map.pool) - map.pool.radius },
  ];
  const named = options.filter(
    (o) => t.includes(o.src) || (o.src === "pool" && t.includes("mirror")),
  );
  const pool = (named.length ? named : options).filter((o) => o.d <= cfg.gatherSearchRadius);
  pool.sort((p, q) => p.d - q.d);
  const best = pool[0];
  if (!best) return null;
  // Reach to the water from the bank, or the edge of the raised spring basin.
  const minDistance =
    best.src === "river"
      ? map.riverWidth / 2 + 0.5
      : best.src === "pool"
        ? map.pool.radius + 0.5
        : cfg.walk.springRadius + cfg.walk.radius;
  return { src: best.src, at: best.at, minDistance };
}

function approachWater(
  w: WorldState,
  a: Actor,
  s: NonNullable<ReturnType<typeof waterSource>>,
  cfg: WorldConfig,
): WalkPlan {
  const map = walkMapOf(w, cfg);
  const waterRadius =
    s.src === "pool" ? map.pool.radius : s.src === "river" ? map.riverWidth / 2 : 0;
  return planWalkNear(map, a.pos, s.at, waterRadius + cfg.reach, cfg, s.minDistance);
}

const jarOf = (inv: Inventory): { fill: number; quality: string } | null => {
  const s = inv.find((i) => i.item === "water_jar");
  if (!s) return null;
  const p = (s.props ?? {}) as { fill?: number; quality?: string };
  return { fill: Number(p.fill ?? 0), quality: String(p.quality ?? "clean") };
};
const withJar = (inv: Inventory, fill: number, quality: string): Inventory =>
  inv.map((s) =>
    s.item === "water_jar" ? { ...s, props: { ...(s.props ?? {}), fill, quality } } : s,
  );

export function drink(
  w: WorldState,
  a: Actor,
  source: string,
  cfg: WorldConfig = WORLD_CONFIG,
): ActionResult {
  const wc = cfg.water;
  const relief = 1 - wc.skillRelief * sk(a, "drinking_water_safety");
  const t = source.toLowerCase();
  const named = ["spring", "river", "pool", "mirror", "stream", "rain"].some((k) => t.includes(k));
  const jar = jarOf(a.inventory);
  if (t.includes("rain")) {
    const p = wetNow(w, cfg);
    if (p <= 0) return fail(w, a, "It is not raining; there is nothing to catch.");
    return {
      ok: true,
      minutes: wc.drinkMinutes,
      text: "You tilt your head back and drink the rain.",
      world: w,
      actor: a,
      facts: {
        hydration: wc.sip,
        contamination: wc.rainIllness * relief,
        boiled: false,
        source: "rain",
      },
    };
  }
  if (!named && jar && jar.fill > 0) {
    const q = jar.quality;
    const ill =
      q === "clean" || q === "boiled"
        ? 0
        : (q === "pool" ? wc.poolIllness : wc.riverIllness) * relief;
    return {
      ok: true,
      minutes: wc.drinkMinutes,
      text: "You drink from the jar.",
      world: w,
      actor: { ...a, inventory: withJar(a.inventory, jar.fill - 1, q) },
      facts: { hydration: wc.sip, contamination: ill, boiled: q === "boiled", source: "jar" },
    };
  }
  if (t.includes("jar") && jar && jar.fill <= 0) return fail(w, a, "The jar is empty.", 1);
  const s = waterSource(w, a, t.replace(/jar|water/g, ""), cfg);
  if (!s)
    return fail(
      w,
      a,
      jar && !named
        ? "The jar is empty, and there is no water close by."
        : "You see no water close enough to drink from.",
      2,
    );
  const walk = approachWater(w, a, s, cfg);
  if (!walk.reached) return fail(w, a, "You cannot find a clear way to reach the water.");
  const ill = SRC_ILL(cfg)[s.src] * relief;
  const word = s.src === "spring" ? "the spring" : s.src === "river" ? "the river" : "the pool";
  return {
    ok: true,
    minutes: walk.minutes + wc.drinkMinutes,
    text: `You kneel and drink from ${word}.`,
    world: w,
    actor: { ...a, pos: walk.points[walk.points.length - 1]! },
    facts: { hydration: wc.sip, contamination: ill, boiled: false, source: s.src },
    walk,
  };
}

/** Fill the jar from a nearby source. */
export function fillJar(
  w: WorldState,
  a: Actor,
  source: string,
  cfg: WorldConfig = WORLD_CONFIG,
): ActionResult {
  const jar = jarOf(a.inventory);
  if (!jar) return fail(w, a, "You have nothing to carry water in.");
  const s = waterSource(w, a, source, cfg);
  if (!s || s.src === "rain")
    return fail(w, a, "You see no water close enough to fill it from.", 2);
  const walk = approachWater(w, a, s, cfg);
  if (!walk.reached) return fail(w, a, "You cannot find a clear way to reach the water.");
  const q = s.src === "spring" ? "clean" : s.src;
  const mixed = jar.fill > 0 && jar.quality !== q && q === "clean" ? jar.quality : q;
  return {
    ok: true,
    minutes: walk.minutes + cfg.water.fillMinutes,
    text: "You fill the jar.",
    world: w,
    actor: {
      ...a,
      pos: walk.points[walk.points.length - 1]!,
      inventory: withJar(a.inventory, cfg.water.jarDrinks, mixed),
    },
    facts: { source: s.src },
    walk,
  };
}

export function useItem(
  w: WorldState,
  a: Actor,
  item: string,
  target: string | undefined,
  cfg: WorldConfig = WORLD_CONFIG,
): ActionResult {
  const s = findItem(a.inventory, item);
  if (!s) return fail(w, a, "You have nothing like that.");
  if (s.item === "water_jar" && target) return fillJar(w, a, target, cfg);
  return fail(w, a, "You turn it over in your hands, but nothing comes of it.", 1);
}

// ---------------- eat ----------------
export function eat(
  w: WorldState,
  a: Actor,
  item: string,
  cfg: WorldConfig = WORLD_CONFIG,
): ActionResult {
  const s = findItem(a.inventory, item);
  if (!s) return fail(w, a, "You have nothing like that to eat.");
  const fx = foodEffects(s.item, s.condition ?? 1, cfg);
  if (!fx) return fail(w, a, "That is not something you can eat.");
  const rem = invRemove(a.inventory, s.item, 1);
  // keep condition on remaining stacks (invRemove preserves it)
  const spoiled = (s.condition ?? 1) < 0.25;
  return {
    ok: true,
    minutes: cfg.food.eatMinutes,
    text: spoiled
      ? "You eat it, though it is rotten."
      : `You eat ${describeStack({ item: s.item, qty: 1 }).replace(/^(a|an) /, "a ")}.`,
    world: w,
    actor: { ...a, inventory: rem.inventory },
    facts: {
      satiety: fx.satiety,
      reserve: fx.energy_reserve,
      hydration: fx.hydration,
      // illness_chance already includes spoilage illness (see foodEffects); the body must apply it once
      toxic: fx.illness_chance,
      spoil: 1 - (s.condition ?? 1),
      nutrient: fx.nutrient ?? "none",
      medicinal: fx.medicinal,
      item: s.item,
    },
  };
}

// ---------------- fire ----------------
function dryGround(map: WorldMap, p: Vec, radius: number): boolean {
  return (
    Math.hypot(p.x, p.z) + radius <= map.radius &&
    dist(p, map.pool) > map.pool.radius + radius &&
    dist(p, nearestOnPolyline(p, map.river)) > map.riverWidth / 2 + radius
  );
}

function campfireSite(map: WorldMap, from: Vec, cfg: WorldConfig): Vec | undefined {
  const { campRadius, campStandOff, campTreeClearance } = cfg.fire;
  const props = walkObstacles(map, cfg, campRadius);
  const trees = map.nodes.filter((n) => n.kind === "tree" || n.kind === "fruit_tree");
  const door = map.stations.door;
  const yard = map.waypoints["yard"] ?? cfg.map.yard;
  const passageClearance = campRadius + cfg.walk.radius;
  const start = Math.atan2(from.x, from.z);
  for (const d of [campStandOff, (campStandOff + cfg.reach) / 2, cfg.reach]) {
    if (d < campStandOff || d > cfg.reach) continue;
    for (let i = 0; i < cfg.walk.cornerCount; i++) {
      const offset = polar(start + (i * Math.PI * 2) / cfg.walk.cornerCount, d);
      const site = { x: from.x + offset.x, z: from.z + offset.z };
      if (
        !insideCabin(map, site) &&
        // Keep the single entrance and its approach from the yard passable.
        dist(site, nearestOnSegment(site, door, yard)) > passageClearance &&
        dryGround(map, site, campRadius) &&
        !trees.some((tree) => dist(tree, site) <= campTreeClearance) &&
        !props.some((prop) => hitsWalkObstacle(prop, site, site)) &&
        clearWalkSegment(map, from, site, cfg)
      )
        return site;
    }
  }
  return undefined;
}

function reachableFire(w: WorldState, a: Actor, reach: number, cfg: WorldConfig): Fire | undefined {
  const indoors = insideCabin(mapOf(w, cfg), a.pos);
  return nearestFire(
    w.fires.filter((fire) => fire.indoors === indoors),
    a.pos,
    w.t,
    reach,
    cfg,
  );
}

export function makeFire(w: WorldState, a: Actor, cfg: WorldConfig = WORLD_CONFIG): ActionResult {
  const fc = cfg.fire;
  const map = walkMapOf(w, cfg);
  if (invCount(a.inventory, "flint_steel") < 1)
    return fail(w, a, "You have nothing to strike a spark with.");
  if (invCount(a.inventory, "tinder") < 1)
    return fail(w, a, "You have no dry tinder to catch a spark.");
  if (invCount(a.inventory, "firewood") < fc.kindlingLogs)
    return fail(w, a, "You do not have enough wood to build a fire.");
  const inside = insideCabin(map, a.pos);
  const hearth = w.fires.find((f) => f.hearth);
  const existing = reachableFire(w, a, cfg.reach, cfg);
  if (existing) return fail(w, a, "A fire is already burning right here.");
  if (inside && (!hearth || dist(a.pos, hearth) > cfg.reach))
    return fail(w, a, "A fire belongs in the hearth, not on the floor.");
  const site = inside ? hearth : campfireSite(map, a.pos, cfg);
  if (!site) return fail(w, a, "You cannot find clear, dry ground within reach for the fire.");
  const precip = inside ? 0 : wetNow(w, cfg) * (1 - shelterAt(w, site, cfg).quality);
  const p = Math.min(
    0.97,
    Math.max(
      0.05,
      (fc.baseSuccess + fc.skillSuccess * sk(a, "fire_making")) * (1 - fc.wetPenalty * precip),
    ),
  );
  const rng = rngFrom(
    w.seed,
    w.t,
    77,
    invCount(a.inventory, "tinder"),
    Math.floor(a.pos.x * 10),
    Math.floor(a.pos.z * 10),
  );
  const minutes = fc.makeMinutes * (1.4 - 0.6 * sk(a, "fire_making"));
  let inv = invRemove(a.inventory, "tinder", 1).inventory;
  if (rng() >= p) {
    return {
      ok: false,
      minutes,
      text:
        precip > 0
          ? "The tinder is damp here and will not catch."
          : "The sparks fly but the tinder will not take.",
      world: w,
      actor: { ...a, inventory: inv },
      facts: { success: false, burn_risk: 0.1 },
    };
  }
  inv = invRemove(inv, "firewood", fc.kindlingLogs).inventory;
  const fuel = fc.kindlingLogs * fc.fuelPerLog;
  let world: WorldState;
  let id: number;
  if (inside && hearth) {
    id = hearth.id;
    world = setFire(w, { ...hearth, fuel, litAt: w.t, outAt: null });
  } else {
    id = w.nextFireId;
    world = {
      ...w,
      nextFireId: id + 1,
      fires: [
        ...w.fires,
        {
          id,
          x: site.x,
          z: site.z,
          fuel,
          indoors: false,
          litAt: w.t,
          outAt: null,
          hearth: false,
        },
      ],
    };
  }
  return {
    ok: true,
    minutes,
    text: inside
      ? "The tinder catches and a small fire takes hold in the hearth."
      : "The tinder catches and a small fire takes hold on the clear ground beside you.",
    world,
    actor: { ...a, inventory: inv },
    facts: { success: true, fire: id, burn_risk: 0.1 },
  };
}

export function tendFire(w: WorldState, a: Actor, cfg: WorldConfig = WORLD_CONFIG): ActionResult {
  const fc = cfg.fire;
  const f = reachableFire(w, a, cfg.reach + 1, cfg);
  if (!f) return fail(w, a, "There is no fire here to tend.");
  if (invCount(a.inventory, "firewood") < fc.tendLogs)
    return fail(w, a, "You have no wood to add.", 2);
  const inv = invRemove(a.inventory, "firewood", fc.tendLogs).inventory;
  const fuel = Math.min(fc.maxFuel, f.fuel + fc.tendLogs * fc.fuelPerLog);
  return {
    ok: true,
    minutes: fc.tendMinutes,
    text: "You feed the fire and settle the embers.",
    world: setFire(w, { ...f, fuel }),
    actor: { ...a, inventory: inv },
    facts: { fire: f.id, burn_risk: 0.05 },
  };
}

export function boilWater(w: WorldState, a: Actor, cfg: WorldConfig = WORLD_CONFIG): ActionResult {
  const fc = cfg.fire;
  const f = reachableFire(w, a, cfg.reach + 1, cfg);
  if (!f) return fail(w, a, "You need a fire to heat water.");
  if (invCount(a.inventory, "cooking_pot") < 1)
    return fail(w, a, "You have no pot to heat water in.");
  const jar = jarOf(a.inventory);
  if (!jar || jar.fill <= 0) return fail(w, a, "You have no water to heat.");
  if (jar.quality === "clean" || jar.quality === "boiled")
    return fail(w, a, "The water in the jar already looks clear and clean.", 1);
  return {
    ok: true,
    minutes: fc.boilMinutes,
    text: "You heat the water until it rolls and bubbles, then let it cool in the jar.",
    world: setFire(w, useFuel(f, fc.boilFuel, w.t)),
    actor: { ...a, inventory: withJar(a.inventory, jar.fill, "boiled") },
    facts: { boiled: true, burn_risk: 0.1 },
  };
}

export function cook(
  w: WorldState,
  a: Actor,
  item: string,
  cfg: WorldConfig = WORLD_CONFIG,
): ActionResult {
  const fc = cfg.fire;
  const f = reachableFire(w, a, cfg.reach + 1, cfg);
  if (!f) return fail(w, a, "You need a fire to cook over.");
  if (invCount(a.inventory, "cooking_pot") < 1) return fail(w, a, "You have no pot to cook in.");
  const s = findItem(a.inventory, item);
  const to = s ? ITEM_DEFS[s.item]?.cooksTo : undefined;
  if (!s || !to) return fail(w, a, "That is not something you can cook.");
  const inv = invAdd(invRemove(a.inventory, s.item, 1).inventory, to, 1);
  return {
    ok: true,
    minutes: fc.cookMinutes,
    text: `You cook ${describeStack({ item: to, qty: 1 })}.`,
    world: setFire(w, useFuel(f, fc.cookFuel, w.t)),
    actor: { ...a, inventory: inv },
    facts: { burn_risk: 0.1, item: to },
  };
}

// ---------------- wear / shelter / rest ----------------
export function wear(w: WorldState, a: Actor, item: string, remove = false): ActionResult {
  const s = findItem(a.inventory, item);
  if (!s || !ITEM_DEFS[s.item]?.insulation)
    return fail(w, a, "That is not something you can wear.");
  const was = !!(s.props as { worn?: boolean } | undefined)?.worn;
  if (was === !remove)
    return {
      ...fail(w, a, remove ? "You are not wearing that." : "You are already wearing that."),
      ok: false,
    };
  const ins = ITEM_DEFS[s.item]?.insulation ?? 0;
  const inv = a.inventory.map((x) =>
    x === s ? { ...x, props: { ...(x.props ?? {}), worn: !remove } } : x,
  );
  return {
    ok: true,
    minutes: 2,
    text: remove ? "You take it off." : "You put it on.",
    world: w,
    actor: { ...a, inventory: inv },
    facts: { insulationDelta: remove ? -ins : ins },
  };
}

export function repairShelter(
  w: WorldState,
  a: Actor,
  cfg: WorldConfig = WORLD_CONFIG,
): ActionResult {
  const sc = cfg.shelter;
  if (Math.hypot(a.pos.x, a.pos.z) > cfg.map.cabin.halfW + 8)
    return fail(w, a, "There is nothing here to mend.");
  if (invCount(a.inventory, "firewood") < sc.repairLogs)
    return fail(w, a, "You have no wood to mend it with.");
  if (w.cabinIntegrity >= 0.999) return fail(w, a, "The walls and roof look sound.", 3);
  const inv = invRemove(a.inventory, "firewood", sc.repairLogs).inventory;
  const gain = sc.repairGain * (0.5 + sk(a, "shelter_warmth"));
  return {
    ok: true,
    minutes: sc.repairMinutes,
    text: "You patch gaps in the walls and roof.",
    world: { ...w, cabinIntegrity: Math.min(1, w.cabinIntegrity + gain) },
    actor: { ...a, inventory: inv },
    facts: { work: "repair", effort: 0.6 },
  };
}

/** Where is a good place to rest? Used for rest/sleep: shelter kind and quality, plus whether on the bed. */
export function restSpot(
  w: WorldState,
  p: Vec,
  cfg: WorldConfig = WORLD_CONFIG,
): { shelter: "open" | "canopy" | "cabin"; quality: number; on_bed: boolean; clear: boolean } {
  const map = walkMapOf(w, cfg);
  const { kind: shelter, quality } = shelterAt(w, p, cfg);
  return {
    shelter,
    quality,
    on_bed: shelter === "cabin" && dist(p, map.stations.bed) <= cfg.shelter.bedReach,
    clear: clearWalkSegment(map, p, p, cfg) && dryGround(map, p, cfg.walk.radius),
  };
}

/** Choose an unobstructed lying direction near the Resident's current facing. */
export function restHeading(
  w: WorldState,
  pose: Pose,
  cfg: WorldConfig = WORLD_CONFIG,
): number | undefined {
  const spot = restSpot(w, pose, cfg);
  if (!spot.clear) return undefined;
  if (spot.on_bed) return 0;
  const map = walkMapOf(w, cfg);
  for (let i = 0; i < cfg.walk.cornerCount; i++) {
    const step = i % 2 === 0 ? -i / 2 : (i + 1) / 2;
    const heading = pose.heading + (Math.PI * step) / cfg.walk.cornerCount;
    const offset = polar(heading, cfg.shelter.restHalfLength);
    const head = { x: pose.x - offset.x, z: pose.z - offset.z };
    const feet = { x: pose.x + offset.x, z: pose.z + offset.z };
    if (
      insideCabin(map, head) === insideCabin(map, pose) &&
      insideCabin(map, feet) === insideCabin(map, pose) &&
      dryGround(map, head, cfg.walk.radius) &&
      dryGround(map, feet, cfg.walk.radius) &&
      clearWalkSegment(map, head, feet, cfg)
    )
      return heading;
  }
  return undefined;
}
