import { SCHEMA_VERSION, type Event } from "@truman/contracts";
import { describe, expect, it } from "vitest";
import { DEMO_SNAPSHOT } from "../api/demoData";
import { evaluateTimeline, snapshotAt } from "./timeline";

const T0 = Date.parse("2026-11-26T12:00:00.000Z");
const iso = (sec: number) => new Date(T0 + sec * 1000).toISOString();

describe("evaluateTimeline", () => {
  it("interpolates walk waypoints and marks mid-action state", () => {
    const events: Event[] = [
      {
        v: SCHEMA_VERSION,
        seq: 1,
        t_start: iso(0),
        t_end: iso(10),
        actor: "resident",
        kind: "walk",
        data: {
          waypoints: [
            { x: 0, z: 0 },
            { x: 10, z: 0 },
          ],
          speed: 1,
        },
        log_id: 1,
      },
    ];

    const mid = evaluateTimeline(DEMO_SNAPSHOT, events, T0 + 5_000);
    expect(mid.pose.x).toBeCloseTo(5, 3);
    expect(mid.pose.z).toBeCloseTo(0, 3);
    expect(mid.poseAnim).toBe("walk");
    expect(mid.midAction).toBe(true);

    const after = evaluateTimeline(DEMO_SNAPSHOT, events, T0 + 15_000);
    expect(after.pose.x).toBeCloseTo(10, 3);
    expect(after.midAction).toBe(false);
    expect(after.poseAnim).toBe("idle");
  });

  it("retains replayed walk endpoints before the snapshot and uses its newer live pose", () => {
    const snapshot = {
      ...DEMO_SNAPSHOT,
      generated_at: iso(20),
      resident: {
        ...DEMO_SNAPSHOT.resident,
        pose: { x: 14, z: 6, heading: 1 },
      },
    };
    const events: Event[] = [
      {
        v: SCHEMA_VERSION,
        seq: 1,
        t_start: iso(0),
        t_end: iso(10),
        actor: "resident",
        kind: "walk",
        data: {
          waypoints: [
            { x: 0, z: 0 },
            { x: 10, z: 0 },
          ],
          speed: 1,
        },
        log_id: 1,
      },
    ];

    expect(evaluateTimeline(snapshot, events, T0 + 15_000).pose).toMatchObject({ x: 10, z: 0 });
    expect(evaluateTimeline(snapshot, events, T0 + 25_000).pose).toEqual(snapshot.resident.pose);
  });

  it("applies anim, body physiology, thought, and world events up to atMs", () => {
    const events: Event[] = [
      {
        v: SCHEMA_VERSION,
        seq: 1,
        t_start: iso(0),
        t_end: iso(30),
        actor: "world",
        kind: "world",
        data: { weather: "rain", time_of_day: "dusk" },
        log_id: 1,
      },
      {
        v: SCHEMA_VERSION,
        seq: 2,
        t_start: iso(2),
        t_end: iso(20),
        actor: "resident",
        kind: "anim",
        data: { name: "tend_fire", station: "door" },
        log_id: 2,
      },
      {
        v: SCHEMA_VERSION,
        seq: 3,
        t_start: iso(4),
        t_end: iso(20),
        actor: "resident",
        kind: "body",
        data: {
          heart_rate: 96,
          breath_rate: 21,
          posture_openness: 0.5,
          heaviness: 0.4,
          muscle_tension: 0.6,
        },
        log_id: 2,
      },
      {
        v: SCHEMA_VERSION,
        seq: 4,
        t_start: iso(5),
        t_end: iso(25),
        actor: "resident",
        kind: "thought",
        data: { text: "The rain is tapping on the roof." },
        log_id: 3,
      },
    ];

    const st = evaluateTimeline(DEMO_SNAPSHOT, events, T0 + 10_000);
    expect(st.weather).toBe("rain");
    expect(st.timeOfDay).toBe("dusk");
    expect(st.poseAnim).toBe("tend_fire");
    expect(st.midAction).toBe(true);
    expect(st.physiology.heart_rate).toBe(96);
    expect(st.physiology.breath_rate).toBe(21);
    expect(st.thought).toBe("The rain is tapping on the roof.");
  });

  it("restores idle pose and weather from the correct anchor across historical ticks", () => {
    const early = { ...DEMO_SNAPSHOT, generated_at: iso(0) };
    const middle = {
      ...early,
      generated_at: iso(30),
      world: { ...early.world, weather: "clear" },
      resident: { ...early.resident, pose: { x: 4, z: 5, heading: 1 } },
    };
    const latest = {
      ...middle,
      generated_at: iso(60),
      resident: { ...middle.resident, pose: { x: 14, z: 16, heading: 2 } },
    };
    const anchors = [early, middle, latest];
    const events: Event[] = [
      {
        v: SCHEMA_VERSION,
        seq: 1,
        t_start: iso(5),
        t_end: iso(25),
        actor: "world",
        kind: "world",
        data: { weather: "rain", time_of_day: "dusk" },
        log_id: null,
      },
    ];

    expect(
      evaluateTimeline(snapshotAt(latest, anchors, T0 + 10_000), events, T0 + 10_000),
    ).toMatchObject({ pose: early.resident.pose, weather: "rain" });
    expect(
      evaluateTimeline(snapshotAt(latest, anchors, T0 + 40_000), events, T0 + 40_000),
    ).toMatchObject({ pose: middle.resident.pose, weather: "clear" });
  });

  it("uses the snapshot sky with no fires during a quiet window", () => {
    const snapshot = {
      ...DEMO_SNAPSHOT,
      world: {
        ...DEMO_SNAPSHOT.world,
        time_of_day: "night" as const,
        entities: [],
      },
    };
    const state = evaluateTimeline(snapshot, [], T0);
    expect(state.timeOfDay).toBe("night");
    expect(state.fires).toEqual([]);
  });

  it("tracks the hearth and multiple outdoor fires independently through ignition and burnout", () => {
    const snapshot = {
      ...DEMO_SNAPSHOT,
      generated_at: iso(0),
      world: {
        ...DEMO_SNAPSHOT.world,
        entities: [
          ...DEMO_SNAPSHOT.world.entities,
          { id: "fire_2", type: "fire", x: 4, z: -25, appearance: { state: "dying" } },
        ],
      },
    };
    const transition = (
      sequence: number,
      at: number,
      data: Extract<Event, { kind: "fire" }>["data"],
    ): Event => ({
      v: SCHEMA_VERSION,
      seq: sequence,
      t_start: iso(at),
      t_end: iso(at),
      actor: "world",
      kind: "fire",
      data,
      log_id: null,
    });
    const events = [
      transition(1, -5, { id: "hearth_fire", state: "out", x: 2, z: 0.7 }),
      transition(2, 5, { id: "fire_3", state: "lit", x: 3, z: -23 }),
      transition(3, 10, { state: "out", x: 4, z: -25 }),
    ];
    expect(evaluateTimeline(snapshot, events, T0).fires).toMatchObject([
      { id: "hearth_fire", state: "burning", x: 2, z: 0.7 },
      { id: "fire_2", state: "dying", x: 4, z: -25 },
    ]);
    expect(evaluateTimeline(snapshot, events, T0 + 5_000).fires).toMatchObject([
      { id: "hearth_fire", state: "burning" },
      { id: "fire_2", state: "dying" },
      { id: "fire_3", state: "lit", x: 3, z: -23 },
    ]);
    expect(evaluateTimeline(snapshot, events, T0 + 10_000).fires).toMatchObject([
      { id: "hearth_fire", state: "burning" },
      { id: "fire_2", state: "out", x: 4, z: -25 },
      { id: "fire_3", state: "lit" },
    ]);
  });

  it("places old fire events without an entity ID", () => {
    const event: Event = {
      v: SCHEMA_VERSION,
      seq: 1,
      t_start: iso(5),
      t_end: iso(5),
      actor: "world",
      kind: "fire",
      data: { state: "burning", x: 3, z: -23 },
      log_id: null,
    };
    const snapshot = { ...DEMO_SNAPSHOT, generated_at: iso(0) };
    expect(evaluateTimeline(snapshot, [event], T0 + 5_000).fires).toContainEqual({
      id: "fire_at_3_-23",
      state: "burning",
      x: 3,
      z: -23,
    });
  });

  it("carries the resting position metadata until waking", () => {
    const snapshot = { ...DEMO_SNAPSHOT, generated_at: iso(0) };
    const events: Event[] = [
      {
        v: SCHEMA_VERSION,
        seq: 1,
        t_start: iso(2),
        t_end: iso(10),
        actor: "resident",
        kind: "sleep_start",
        data: { on_bed: false, heading: Math.PI / 2 },
        log_id: null,
      },
      {
        v: SCHEMA_VERSION,
        seq: 2,
        t_start: iso(10),
        t_end: iso(10),
        actor: "resident",
        kind: "sleep_end",
        data: {},
        log_id: null,
      },
    ];
    expect(evaluateTimeline(snapshot, events, T0 + 5_000)).toMatchObject({
      poseAnim: "sleep",
      restPlacement: { onBed: false, heading: Math.PI / 2 },
    });
    expect(evaluateTimeline(snapshot, events, T0 + 10_000)).toMatchObject({
      poseAnim: "idle",
      restPlacement: null,
    });
  });

  it("shows a link-only thought alongside an active action and clears it at expiry", () => {
    const events: Event[] = [
      {
        v: SCHEMA_VERSION,
        seq: 1,
        t_start: iso(0),
        t_end: iso(10),
        actor: "resident",
        kind: "anim",
        data: { name: "thinking" },
        log_id: 10,
      },
      {
        v: SCHEMA_VERSION,
        seq: 2,
        t_start: iso(2),
        t_end: iso(20),
        actor: "resident",
        kind: "anim",
        data: { name: "read" },
        log_id: 11,
      },
    ];
    const during = evaluateTimeline(DEMO_SNAPSHOT, events, T0 + 5_000);
    expect(during.thought).toBeNull();
    expect(during.thinking).toBe(true);
    expect(during.thoughtLogId).toBe(10);
    expect(during.poseAnim).toBe("desk");
    expect(during.activeEventSeq).toBe(2);

    const after = evaluateTimeline(DEMO_SNAPSHOT, events, T0 + 12_000);
    expect(after.thinking).toBe(false);
    expect(after.thoughtLogId).toBeNull();
    expect(after.poseAnim).toBe("desk");
  });

  it("enters permanent death/memorial state on death event", () => {
    const events: Event[] = [
      {
        v: SCHEMA_VERSION,
        seq: 10,
        t_start: iso(10),
        t_end: iso(10),
        actor: "resident",
        kind: "death",
        data: { cause: "hypothermia" },
        log_id: 99,
      },
    ];

    const before = evaluateTimeline(DEMO_SNAPSHOT, events, T0 + 5_000);
    expect(before.alive).toBe(true);

    const after = evaluateTimeline(DEMO_SNAPSHOT, events, T0 + 12_000);
    expect(after.alive).toBe(false);
    expect(after.poseAnim).toBe("dead");
    expect(after.causeOfDeath).toBe("hypothermia");
    expect(after.status).toBe("dead");
  });
});
