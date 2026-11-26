import { SCHEMA_VERSION, type Event } from "@truman/contracts";
import { describe, expect, it } from "vitest";
import { DEMO_SNAPSHOT } from "../api/demoData";
import { evaluateTimeline } from "./timeline";

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

  it("uses the snapshot sky and hearth during a quiet window", () => {
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
    expect(state.fire.state).toBe("out");
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
