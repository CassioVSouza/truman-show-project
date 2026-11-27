// Tests for 4x world time (Decision 44): clock anchor, smooth legacy 1x -> 4x migration,
// real-time decision cadence (normal & thrifty), viewer event timestamps, and snapshot world_day.
import { describe, expect, test, vi } from "vitest";
import type { LiveFeed } from "@truman/contracts";
import { DEFAULT_GOVERNOR } from "../governor";
import { FakeProvider } from "../llm";
import { LogWriter } from "../log";
import { createSnapshotPublisher } from "../snapshot";
import { MemoryRows } from "./memory-log";
import { runMindTick } from "./pipeline";
import { anchorClock, genesis, isoAt, worldTimeAt, type MindState } from "./state";
import { SimDb } from "./testkit";

const BASE = Date.parse("2026-11-26T00:00:00.000Z");
const MIN = 60_000;

const thinkProvider = () =>
  new FakeProvider("fake", () => ({
    action: {
      type: "think",
      thought: "I listen to the wind.",
      intent: "Take a moment to think.",
      expectation: "Things will stay calm.",
    },
  }));

describe("4x world time (Decision 44)", () => {
  test("new Resident at 4x advances 40 world min in 10 real min and 4 world days in 24 real hours", async () => {
    const db = new SimDb();
    const providers = [thinkProvider()];

    // Tick 0 at t=0
    await runMindTick({
      db,
      log: new LogWriter(),
      rows: new MemoryRows(),
      providers,
      now: () => new Date(BASE),
      governor: { ...DEFAULT_GOVERNOR, timeScale: 4 },
    });
    expect(db.mind?.clock_scale).toBe(4);
    expect(db.mind?.clock_anchor_ms).toBe(BASE);
    expect(db.mind?.clock_anchor_t).toBe(0);

    // Tick 1 at +10 real minutes -> +40 world minutes
    const t10 = BASE + 10 * MIN;
    await runMindTick({
      db,
      log: new LogWriter(),
      rows: new MemoryRows(),
      providers,
      now: () => new Date(t10),
      governor: { ...DEFAULT_GOVERNOR, timeScale: 4 },
    });
    expect(worldTimeAt(db.mind!, t10)).toBeCloseTo(40, 6);
    // think takes 3 world min after catch-up to 40 -> world.t = 43
    expect(db.mind!.world.t).toBeCloseTo(43, 6);

    // 24 real hours = 1440 real minutes -> 5760 world minutes = 4 full world days
    const t24h = BASE + 1440 * MIN;
    expect(worldTimeAt(db.mind!, t24h)).toBeCloseTo(4 * 1440, 6);
  });

  test("legacy 1x MindState (idle) migrates to 4x with zero jump and advances 4x thereafter", async () => {
    const bornMs = BASE;
    // Construct a legacy 1x blob: no clock_anchor_ms / clock_anchor_t / clock_scale / last_decision_ms
    const legacy: MindState = genesis(7, bornMs, 1);
    delete legacy.clock_anchor_ms;
    delete legacy.clock_anchor_t;
    delete legacy.clock_scale;
    delete legacy.last_decision_ms;
    // Simulate 2 days (2880 min) of 1x life; last tick ran 10 real min ago at t=2870
    legacy.world = { ...legacy.world, t: 2870 };
    legacy.body = { ...legacy.body, t: 2870 };
    legacy.last_decision_t = 2870;

    const db = new SimDb();
    db.kv["mind"] = legacy;

    // First tick under 4x at born + 2880 real min
    const upgradeMs = bornMs + 2880 * MIN;
    const r1 = await runMindTick({
      db,
      log: new LogWriter(),
      rows: new MemoryRows(),
      providers: [thinkProvider()],
      now: () => new Date(upgradeMs),
      governor: { ...DEFAULT_GOVERNOR, timeScale: 4 },
    });

    // Must NOT jump to 2880 * 4 = 11520! Must stay at 2880 (+3 min think = 2883)
    expect(r1.step).toBe("decided");
    expect(db.mind!.clock_anchor_ms).toBe(upgradeMs);
    expect(db.mind!.clock_anchor_t).toBeCloseTo(2880, 6);
    expect(db.mind!.clock_scale).toBe(4);
    expect(db.mind!.world.t).toBeCloseTo(2883, 6);

    // Next tick 10 real min later -> advances 40 world min to 2920 (+3 min think = 2923)
    const nextMs = upgradeMs + 10 * MIN;
    const r2 = await runMindTick({
      db,
      log: new LogWriter(),
      rows: new MemoryRows(),
      providers: [thinkProvider()],
      now: () => new Date(nextMs),
      governor: { ...DEFAULT_GOVERNOR, timeScale: 4 },
    });
    expect(r2.step).toBe("decided");
    expect(db.mind!.world.t).toBeCloseTo(2923, 6);
  });

  test("legacy 1x MindState (mid-sleep macro-action) migrates smoothly without jump and finishes at 4x", async () => {
    const bornMs = BASE;
    const legacy: MindState = genesis(7, bornMs, 1);
    delete legacy.clock_anchor_ms;
    delete legacy.clock_anchor_t;
    delete legacy.clock_scale;
    delete legacy.last_decision_ms;
    // At t=2870 (10 min ago), Resident started an 8-hour (480 world min) sleep -> world.t = 3350
    legacy.world = { ...legacy.world, t: 3350 };
    legacy.body = { ...legacy.body, t: 3350 };
    legacy.last_decision_t = 2870;

    const db = new SimDb();
    db.kv["mind"] = legacy;

    const upgradeMs = bornMs + 2880 * MIN;
    const r1 = await runMindTick({
      db,
      log: new LogWriter(),
      rows: new MemoryRows(),
      providers: [thinkProvider()],
      now: () => new Date(upgradeMs),
      governor: { ...DEFAULT_GOVERNOR, timeScale: 4 },
    });
    // Still mid-sleep (world.t = 3350 > tNow = 2880): continuing, zero LLM calls, no jump
    expect(r1.step).toBe("continuing");
    expect(r1.llm_calls).toBe(0);
    expect(db.mind!.world.t).toBe(3350);
    expect(db.mind!.clock_anchor_t).toBeCloseTo(2880, 6);
    expect(db.mind!.clock_scale).toBe(4);

    // 470 world minutes remain; at 4x that is 117.5 real minutes.
    // At +110 real min (tNow = 3320 < 3350): still sleeping
    const rStill = await runMindTick({
      db,
      log: new LogWriter(),
      rows: new MemoryRows(),
      providers: [thinkProvider()],
      now: () => new Date(upgradeMs + 110 * MIN),
      governor: { ...DEFAULT_GOVERNOR, timeScale: 4 },
    });
    expect(rStill.step).toBe("continuing");

    // At +120 real min (tNow = 3360 >= 3350): awake and decides!
    const rAwake = await runMindTick({
      db,
      log: new LogWriter(),
      rows: new MemoryRows(),
      providers: [thinkProvider()],
      now: () => new Date(upgradeMs + 120 * MIN),
      governor: { ...DEFAULT_GOVERNOR, timeScale: 4 },
    });
    expect(rAwake.step).toBe("decided");
  });

  test("re-anchoring when TIME_SCALE changes mid-run is continuous", () => {
    const m = genesis(1, BASE, 4);
    const tAt60Real = worldTimeAt(m, BASE + 60 * MIN);
    expect(tAt60Real).toBeCloseTo(240, 6);

    const slowed = anchorClock(m, BASE + 60 * MIN, 2);
    expect(worldTimeAt(slowed, BASE + 60 * MIN)).toBeCloseTo(240, 6);
    expect(worldTimeAt(slowed, BASE + 70 * MIN)).toBeCloseTo(260, 6);
    expect(isoAt(slowed, 260)).toBe(new Date(BASE + 70 * MIN).toISOString());
  });

  test("viewer event t_start/t_end map to real wall-clock time (40 world min -> 10 real min) and snapshot tracks 4x world_day", async () => {
    const db = new SimDb();
    // Rest for 1 hour = 60 world min -> should span 15 real min at 4x
    const restProvider = new FakeProvider("fake", () => ({
      action: {
        type: "rest",
        hours: 1,
        thought: "I need a brief rest.",
        intent: "Rest for an hour.",
        expectation: "I will feel steadier.",
      },
    }));

    await runMindTick({
      db,
      log: new LogWriter(),
      rows: new MemoryRows(),
      providers: [restProvider],
      now: () => new Date(BASE),
      governor: { ...DEFAULT_GOVERNOR, timeScale: 4 },
    });

    const events = db.payloads[0]?.events ?? [];
    const restEvt = events.find(
      (e) =>
        (e["kind"] === "anim" && (e["data"] as Record<string, unknown>)?.["name"] === "rest") ||
        e["kind"] === "sleep_start",
    );
    expect(restEvt).toBeDefined();
    const startMs = Date.parse(String(restEvt!["t_start"]));
    const endMs = Date.parse(String(restEvt!["t_end"]));
    expect(startMs).toBe(BASE);
    // 60 world minutes / 4 = 15 real minutes
    expect((endMs - startMs) / MIN).toBeCloseTo(15, 3);

    // Direct check: 40 world minutes maps to exactly 10 real minutes
    expect(Date.parse(isoAt(db.mind!, 40)) - Date.parse(isoAt(db.mind!, 0))).toBe(10 * MIN);

    // Snapshot after 24 real hours at 4x reports world_day = 5 (4 full world days completed)
    const m24 = genesis(17, BASE, 4);
    m24.world = { ...m24.world, t: 4 * 1440 };
    const write = vi.fn<(feed: LiveFeed) => Promise<void>>(async () => undefined);
    await createSnapshotPublisher(
      async () => [],
      write,
    )({
      tickId: 144,
      started: new Date(BASE + 1440 * MIN),
      tickMinutes: 10,
      mind: m24,
      mode: "normal",
      status: "running",
      phase: "unaware",
      lastTickAt: new Date(BASE + 1440 * MIN).toISOString(),
    });
    const feed = write.mock.calls[0]?.[0];
    expect(feed?.status.day).toBe(5);
    expect(feed?.status.world_day).toBe(5);
  });

  test("decision cadence is 3 real min normally and 6 in thrifty mode despite cron dispatch jitter", async () => {
    const db = new SimDb();
    const providers = [thinkProvider()];
    const gov = { ...DEFAULT_GOVERNOR, maxLlmCallsDay: 100 };
    const evening = BASE + 20 * 60 * MIN;
    const run = (nominalMinutes: number, dispatchDelayMs = 0) => {
      const scheduledAtMs = evening + nominalMinutes * MIN;
      return runMindTick({
        db,
        log: new LogWriter(),
        rows: new MemoryRows(),
        providers,
        scheduledAtMs,
        now: () => new Date(scheduledAtMs + dispatchDelayMs),
        governor: gov,
      });
    };

    expect(await run(0, 5_000)).toMatchObject({ step: "decided" });
    expect(await run(2)).toMatchObject({ step: "continuing", llm_calls: 0 });
    expect(await run(3, 1_000)).toMatchObject({ step: "decided" });
    expect(db.mind?.last_decision_ms).toBe(evening + 3 * MIN);
    expect(worldTimeAt(db.mind!, evening + 3 * MIN + 5_000)).toBe(12);

    const b = db.kv["budget"] as Record<string, unknown>;
    db.kv["budget"] = { ...b, llm_calls: 75 };
    expect(await run(6)).toMatchObject({ mode: "thrifty", step: "continuing", llm_calls: 0 });
    expect(await run(9)).toMatchObject({ mode: "thrifty", step: "decided" });
  });
});
