import { describe, expect, test } from "vitest";
import { drink, eat, gather, makeFire, moveTo, cook, wear } from "./actions";
import type { Actor } from "./actions";
import { describeInventory, invAdd, starterInventory } from "./items";
import { generateMap } from "./map";
import { bearingDeg, directionPhrase, lookAt, occupancyGrid, perceive } from "./perception";
import type { Pose, WorldState } from "./types";
import { advance, createWorld } from "./world";

const DAY = 1440;

// Nothing the Resident reads may carry hidden-state or framing words, numbers about the body, or identity.
const BANNED = [
  /health/i,
  /hunger|hungry|starv/i,
  /thirst/i,
  /stamina/i,
  /energy/i,
  /satiety/i,
  /hydration/i,
  /\bpain\b/i,
  /\bfear\b/i,
  /anxi/i,
  /\bhappy|\bsad\b|\bangry/i,
  /emotion|feeling/i,
  /\bdrive\b/i,
  /simulat/i,
  /\bAI\b/,
  /\bmodel\b/i,
  /prompt/i,
  /\bbars?\b/i,
  /toxic/i,
  /poison/i,
  /look-?alike/i,
  /\bnarrator\b/i,
  /\bhe\b|\bshe\b|\bhis\b|\bher\b/i,
  /\byour name\b/i,
  /\bgame\b|\bnpc\b|\bplayer\b/i,
  /\bscore\b|\blevel\b|\bpercent|%/,
];
function clean(text: string) {
  expect(text.length).toBeGreaterThan(0);
  for (const re of BANNED) expect(text, `banned ${re}`).not.toMatch(re);
  // the only digits allowed are distances like "12 m"
  expect(text.replace(/\b\d+ m\b/g, "")).not.toMatch(/\d/);
}

const cases: { seed: number; at: (w: WorldState) => Pose }[] = [];
for (const seed of [1, 2, 3, 11, 99]) {
  cases.push({ seed, at: (w) => ({ ...generateMap(w.seed).stations.bed, heading: 0 }) });
  cases.push({ seed, at: (w) => ({ ...generateMap(w.seed).stations.forest_edge, heading: 1 }) });
  cases.push({ seed, at: (w) => ({ ...generateMap(w.seed).stations.river, heading: 2.5 }) });
  cases.push({ seed, at: (w) => ({ ...generateMap(w.seed).stations.clearing, heading: 4 }) });
  cases.push({ seed, at: (w) => ({ ...generateMap(w.seed).stations.mirror_pool, heading: 5 }) });
}

describe("perception text", () => {
  test("is plain, has no banned words, across seeds, places, headings, hours and weather", () => {
    let lines = 0;
    for (const c of cases) {
      let w = createWorld(c.seed);
      for (let t = 0; t < 4 * DAY; t += 197) {
        w = advance(w, t);
        const p = perceive(w, c.at(w));
        clean(p.text);
        lines += p.lines.length;
        clean(lookAt(w, c.at(w), "the water"));
      }
    }
    expect(lines).toBeGreaterThan(500);
  });
  test("deterministic", () => {
    const w = createWorld(11);
    const pose = { ...generateMap(11).stations.forest_edge, heading: 0.3 };
    expect(perceive(w, pose)).toEqual(perceive(w, pose));
  });
  test("gives distance and direction like the design example", () => {
    const w = advance(createWorld(11), 0);
    const m = generateMap(11);
    const tree = w.nodes.find((n) => n.kind === "tree")!;
    // stand 6 m from a tree, looking straight at it
    const dx = tree.x - 6 * 0.0;
    const pose: Pose = { x: dx, z: tree.z - 6, heading: 0 };
    const p = perceive({ ...w, t: 12 * 60 - w.genesisClock }, pose);
    expect(p.text).toMatch(/tall trees? [^.]*\d+ m/i);
    expect(m.nodes.length).toBeGreaterThan(0);
  });
  test("direction helper: left/right and behind", () => {
    const pose: Pose = { x: 0, z: 0, heading: 0 };
    expect(directionPhrase(bearingDeg(pose, { x: 0, z: 5 }))).toBe("straight ahead");
    expect(directionPhrase(bearingDeg(pose, { x: -2, z: 5 }))).toContain("right"); // -x is to the right when facing +z
    expect(directionPhrase(bearingDeg(pose, { x: 2, z: 5 }))).toContain("left");
    expect(directionPhrase(bearingDeg(pose, { x: 0, z: -5 }))).toBe("behind you");
  });
  test("things behind you are not seen unless very close; night and fog shrink the view", () => {
    const w = createWorld(11);
    const noon = { ...w, t: 12 * 60 - w.genesisClock };
    const midnight = { ...w, t: 24 * 60 - w.genesisClock };
    const pose: Pose = { ...generateMap(11).stations.clearing, heading: 0 };
    expect(perceive(noon, pose).range).toBeGreaterThan(perceive(midnight, pose).range + 20);
    expect(perceive(midnight, pose).lines.some((l) => /dark/.test(l))).toBe(true);
    expect(perceive(noon, pose, { detail: 0.1 }).range).toBeLessThan(perceive(noon, pose).range);
  });
  test("fire is described and extends sight at night", () => {
    const w = createWorld(11);
    const night = { ...w, t: 24 * 60 - w.genesisClock };
    const pose: Pose = { x: 30, z: 30, heading: 0 };
    const withFire: WorldState = {
      ...night,
      fires: [
        ...night.fires,
        { id: 3, x: 30, z: 33, fuel: 200, indoors: false, litAt: -100, outAt: null, hearth: false },
      ],
    };
    expect(perceive(withFire, pose).text).toMatch(/steady fire/);
    clean(perceive(withFire, pose).text);
  });
  test("indoor view lists the room and hides the outdoors", () => {
    const w = createWorld(11);
    const t = perceive(
      { ...w, t: 12 * 60 - w.genesisClock },
      { ...generateMap(11).stations.bed, heading: 0 },
    );
    expect(t.text).toMatch(/desk|table|door|window/);
    expect(t.text).not.toMatch(/tree/);
    expect(t.text).not.toMatch(/Outside|The sky is clear/);
  });
  test("indoors the room comes first and the outdoors is only heard or seen from inside", () => {
    const m = generateMap(11);
    const pose = { ...m.stations.bed, heading: 0 };
    for (let t = 0; t < 3 * DAY; t += 173) {
      const w = advance(createWorld(11), t);
      const p = perceive(w, pose);
      clean(p.text);
      expect(p.text).not.toMatch(/Outside|sky|breeze/i);
      expect(p.lines[0]).toMatch(/bed|desk|table|door|window|stove|hearth|chair|shelf|cabin/i);
    }
  });
  test("the pool reflects when looked at closely in daylight", () => {
    const w = { ...createWorld(11), t: 12 * 60 - 390 };
    const m = generateMap(11);
    const r = lookAt(w, { ...m.stations.mirror_pool, heading: 0 }, "pool");
    expect(r).toMatch(/still/);
    clean(r);
  });
  test("action result texts and inventory text are also clean", () => {
    const w = createWorld(11);
    const m = generateMap(11);
    const a: Actor = {
      pos: { ...m.stations.bed },
      inventory: invAdd(starterInventory(), "firewood", 4),
      skills: { foraging: 25 },
    };
    const outs = [
      moveTo(w, a, "clearing").text,
      describeInventory(a.inventory),
      eat(w, a, "dried food").text,
      drink(w, a, "jar").text,
      wear(w, a, "blanket").text,
      makeFire(w, { ...a, pos: { x: m.hearth.x - 0.8, z: m.hearth.z } }).text,
      gather(w, { ...a, pos: { ...m.stations.clearing } }, "roots").text,
      gather(w, { ...a, pos: { ...m.stations.clearing } }, "berries").text,
      cook(w, a, "roots").text,
    ];
    for (const t of outs) clean(t);
  });
  test("occupancy grid marks water, trees and the world edge", () => {
    const w = createWorld(11);
    const m = generateMap(11);
    const g = occupancyGrid(w, m.stations.river);
    expect(g.cells.length).toBe(g.size * g.size);
    expect(g.cells.includes(2)).toBe(true);
    const g2 = occupancyGrid(w, {
      x: m.stations.forest_edge.x * 1.5,
      z: m.stations.forest_edge.z * 1.5,
    });
    expect(g2.cells.includes(1)).toBe(true);
  });
});

describe("place line (decision 41)", () => {
  test("describes canopy cover and says when there is no fire nearby", () => {
    const w = createWorld(2489842540);
    const tree = w.nodes.find((n) => n.id === "tree_17")!;
    const underCanopy = perceive(w, { x: tree.x + 2, z: tree.z, heading: 0 });
    expect(underCanopy.text).toContain("Branches overhead break some of the wind and rain.");
    expect(underCanopy.text).toContain("There is no fire burning nearby.");
    const inTheOpen = perceive(w, { x: 0, z: 5, heading: 0 });
    expect(inTheOpen.text).toContain("There is no cover overhead here.");
    clean(underCanopy.text);
    clean(inTheOpen.text);
  });
  test("states where the Resident is and the cabin distance behind it, in plain metres", () => {
    const w = createWorld(1);
    const text = perceive(w, { x: 0, z: 15, heading: 0 }).text;
    expect(text).toMatch(/You are (in open forest|in a clearing|beside)/);
    expect(text).toMatch(/The cabin is about \d+ m behind you\./);
    expect(text).toMatch(/The nearest water is /);
    clean(text);
  });
  test("indoors and just outside are named", () => {
    const w = createWorld(1);
    expect(perceive(w, { x: 0, z: 0, heading: 0 }).text).toContain("You are inside the cabin.");
    expect(perceive(w, { x: 0, z: 5, heading: 0 }).text).toContain("just outside the cabin");
  });
  test("cabin ahead when facing it", () => {
    const w = createWorld(1);
    expect(perceive(w, { x: 0, z: 15, heading: Math.PI }).text).toMatch(
      /cabin is about \d+ m (straight )?ahead/,
    );
  });
});
