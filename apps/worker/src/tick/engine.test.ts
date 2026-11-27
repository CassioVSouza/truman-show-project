import { Event } from "@truman/contracts";
import { dist, invAdd, WORLD_CONFIG } from "@truman/world";
import { expect, test } from "vitest";
import { FakeProvider } from "../llm";
import { LogWriter } from "../log";
import { stubTools } from "../tools";
import { executeAction, recoverResidentPosition } from "./engine";
import { MemoryRows } from "./memory-log";
import { runMindTick } from "./pipeline";
import { genesis } from "./state";
import { SimDb } from "./testkit";

const LIVE_SEED = 2489842540;
const BORN = Date.parse("2026-11-26T19:30:00Z");

test("published wood gathering first walks clear of a persisted tree-centered pose", async () => {
  const m = genesis(LIVE_SEED, BORN);
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

test("an active macro-sleep corrects the saved tree overlap before any new decision", async () => {
  const m = genesis(LIVE_SEED, BORN);
  const tree = m.world.nodes.find((node) => node.id === "tree_17")!;
  m.pos = { x: 4.31, z: -24.19, heading: 0 };
  expect(dist(m.pos, tree)).toBe(0);
  m.station = null;
  m.world = {
    ...m.world,
    t: 120,
    fires: [
      ...m.world.fires,
      { id: 1, x: tree.x, z: tree.z, fuel: 0, indoors: false, litAt: 0, outAt: 60, hearth: false },
    ],
    nextFireId: 2,
  };
  m.body = { ...m.body, t: 120, asleep: true };
  const db = new SimDb();
  db.kv["mind"] = m;
  const provider = new FakeProvider("fake", () => {
    throw new Error("A continuing macro-action should not request a decision");
  });
  const result = await runMindTick({
    db,
    log: new LogWriter(),
    rows: new MemoryRows(),
    providers: [provider],
    now: () => new Date(BORN + 3 * 60_000),
  });
  expect(result).toMatchObject({ step: "continuing", llm_calls: 0 });
  expect(provider.calls).toHaveLength(0);
  expect(db.mind?.world.t).toBe(120);
  expect(db.mind?.body.asleep).toBe(true);
  expect(dist(db.mind!.pos, tree)).toBeGreaterThan(
    WORLD_CONFIG.map.treeTrunkRadius + WORLD_CONFIG.walk.radius,
  );
  expect(db.payloads[0]?.log_entries).toContainEqual(
    expect.objectContaining({
      kind: "system",
      category: "lab",
      text: expect.stringMatching(/solid object/),
    }),
  );
});

test("sleep on forest ground and subsequent ignition use distinct, valid sites", async () => {
  let m = genesis(LIVE_SEED, BORN);
  m.pos = { x: 4.31, z: -24.19, heading: 0 };
  m.station = null;
  m.body.sleep_pressure = 0.8;
  m.inventory = invAdd(m.inventory, "firewood", 4);
  m.skills.fire_making = 100;
  m = recoverResidentPosition(m);
  const activity = {
    thought: "Consider this spot.",
    intent: "Use this spot.",
    expectation: "It will work.",
  };
  const allow = { menu: new Set(["rest", "make_fire"]), search: false, fetch: false };
  const rest = await executeAction(m, { type: "rest", hours: 1, ...activity }, stubTools, allow);
  expect(rest.out).toMatchObject({
    ok: true,
    text: expect.stringContaining("on the ground beneath the trees"),
    facts: { slept: true, shelter: "canopy", on_bed: false },
  });
  expect(rest.out.viewer).toContainEqual(
    expect.objectContaining({
      kind: "sleep_start",
      data: { on_bed: false, heading: expect.any(Number) },
    }),
  );

  const made = await executeAction(rest.mind, { type: "make_fire", ...activity }, stubTools, allow);
  expect(made.out.ok, made.out.text).toBe(true);
  const campfire = made.mind.world.fires.find((fire) => !fire.hearth)!;
  expect(dist(campfire, made.mind.pos)).toBeGreaterThan(WORLD_CONFIG.walk.radius);
  expect(made.out.viewer).toContainEqual(
    expect.objectContaining({
      kind: "fire",
      data: { id: "fire_1", state: "lit", x: campfire.x, z: campfire.z },
    }),
  );
  for (const [seq, event] of made.out.viewer.entries())
    expect(Event.safeParse({ ...event, seq, v: 1, actor: "resident", log_id: null }).success).toBe(
      true,
    );
});
