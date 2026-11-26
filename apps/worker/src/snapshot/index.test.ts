import { LiveFeed } from "@truman/contracts";
import { describe, expect, test, vi } from "vitest";
import { SupabaseDb } from "../db/supabase";
import type { TickPayload } from "../db/types";
import { runLiveTick } from "../index";
import { FakeProvider } from "../llm";
import { genesis } from "../tick";
import { createSnapshotPublisher } from "./index";

const started = new Date("2026-11-26T12:00:00.000Z");
const env = {
  SUPABASE_URL: "https://db.test",
  SUPABASE_SERVICE_KEY: "test-service-token-not-real",
};

function event(seq: number, kind: string, data: Record<string, unknown>) {
  return {
    v: 1,
    seq,
    t_start: "2026-11-26T11:55:00+00:00",
    t_end: "2026-11-26T12:30:00+00:00",
    kind,
    actor: "resident",
    log_id: seq + 20,
    data,
    entry: { hidden: false },
  };
}

describe("public snapshot projection", () => {
  test("keeps active timeline events across ticks and drops narration, hidden entries and private state", async () => {
    const privateText = "not-for-an-immutable-copy";
    const mind = genesis(17, started.getTime() - 60_000);
    mind.history = [
      {
        seq: 1,
        type: "think",
        did: privateText,
        intent: "",
        expectation: "",
        outcome: "",
        ok: true,
      },
    ];
    mind.inventory = [
      { item: "water_jar", qty: 1, props: { fill: 2, quality: "river", privateText } },
    ];
    const readEvents = vi.fn(async () => [
      event(9, "world", { weather: "rain", time_of_day: "dusk" }),
      event(8, "sleep_start", {}),
      event(7, "thought", { text: privateText }),
      { ...event(6, "thought", {}), entry: { hidden: true } },
      event(5, "journal", { preview: privateText }),
      event(4, "web_visit", { url: "https://private.test/", title: privateText }),
      event(3, "anim", { name: privateText }),
      event(2, "walk", {
        waypoints: [
          { x: 0, z: 1 },
          { x: 2, z: 3 },
        ],
        speed: 1,
      }),
      {
        ...event(1, "status", { status: "running", reason: privateText }),
        log_id: null,
        entry: null,
      },
    ]);
    const write = vi.fn<(feed: LiveFeed) => Promise<void>>(async () => undefined);
    await createSnapshotPublisher(
      readEvents,
      write,
    )({
      started,
      tickMinutes: 10,
      tickId: 25,
      mind,
      mode: "normal",
      status: "running",
      phase: "unaware",
      lastTickAt: "2026-11-26T12:00:00+00:00",
    });

    expect(readEvents).toHaveBeenCalledExactlyOnceWith(started, new Date("2026-11-26T12:10:00Z"));
    expect(write).toHaveBeenCalledOnce();
    const feed = LiveFeed.parse(write.mock.calls[0]?.[0]);
    expect(feed.snapshot).toMatchObject({
      seq: 25,
      generated_at: started.toISOString(),
      world: { seed: 17 },
      resident: { station: "bed", inventory: [{ props: { fill: 2, quality: "river" } }] },
    });
    expect(feed.status).toMatchObject({
      day: 1,
      mode: "normal",
      last_tick_at: started.toISOString(),
    });
    expect(feed.events.map((e) => [e.seq, e.kind])).toEqual([
      [1, "status"],
      [2, "walk"],
      [4, "anim"],
      [5, "anim"],
      [7, "anim"],
      [8, "sleep_start"],
      [9, "world"],
    ]);
    expect(feed.events[4]).toMatchObject({ log_id: 27, data: { name: "thinking" } });
    expect(feed.events[5]).toMatchObject({
      t_start: "2026-11-26T11:55:00.000Z",
      t_end: "2026-11-26T12:30:00.000Z",
    });
    const content = JSON.stringify(feed);
    expect(content).not.toContain(privateText);
    expect(content).not.toContain("private.test");
    expect(content).not.toContain("temperament");
    expect(content).not.toContain("lookalike");
  });
});

function wiring(
  action = {
    type: "think",
    thought: "Consider the room.",
    intent: "Look around.",
    expectation: "I will see the cabin.",
  },
) {
  const calls: string[] = [];
  const committed: TickPayload[] = [];
  const lease = {
    acquire: async () => {
      calls.push("acquire");
      return true;
    },
    release: async () => {
      calls.push("release");
    },
  };
  const cfg = { supabaseUrl: env.SUPABASE_URL, supabaseServiceKey: env.SUPABASE_SERVICE_KEY };
  const provider = new FakeProvider("fake", () => ({ action }));
  let failCommit = false;
  const db = new SupabaseDb(cfg, async (input, init) => {
    const url = new URL(input);
    switch (url.pathname) {
      case "/rest/v1/resident":
        return Response.json([{ phase: "unaware", status: "running" }]);
      case "/rest/v1/kv":
        return Response.json([{ key: "world_seed", value: 17 }]);
      case "/rest/v1/rpc/tick_commit": {
        const { payload } = JSON.parse(String(init?.body)) as { payload: TickPayload };
        calls.push(payload.tick.mode === "failed" ? "failed-commit" : "commit");
        if (failCommit && payload.tick.mode !== "failed") return Response.json({}, { status: 500 });
        committed.push(payload);
        return Response.json({ tick_id: 25, log_ids: {} });
      }
      case "/rest/v1/events":
        calls.push("read");
        expect(url.searchParams.get("select")).toContain("entry:log_entries(hidden)");
        expect(url.searchParams.get("t_end")).toBe("gte.2026-11-26T12:00:00.000Z");
        expect(url.searchParams.get("t_start")).toBe("lte.2026-11-26T12:10:00.000Z");
        return Response.json([]);
      default:
        throw new Error("unexpected request");
    }
  });
  return { calls, committed, db, lease, provider, failCommit: () => (failCommit = true) };
}

describe("tick publication", () => {
  test("publishes within the lease, after the one batched commit", async () => {
    const { calls, db, lease, provider } = wiring();
    const result = await runLiveTick(env, {
      db,
      lease,
      providers: [provider],
      now: () => started,
      writeSnapshot: async (feed) => {
        calls.push("publish");
        expect(feed.snapshot.seq).toBe(25);
      },
    });
    expect(result).toMatchObject({ ran: true, tick_id: 25 });
    expect(calls).toEqual(["acquire", "commit", "read", "publish", "release"]);
    expect(db.subrequests).toBe(4);
  });

  test("anchors the snapshot pose at the beginning of a new walk, not the committed destination", async () => {
    const action = {
      type: "move_to",
      station: "river",
      thought: "The river is outside.",
      intent: "Go to the river.",
      expectation: "I will arrive at the bank.",
    };
    const { committed, db, lease, provider } = wiring(action);
    const writeSnapshot = vi.fn<(feed: LiveFeed) => Promise<void>>(async () => undefined);
    const result = await runLiveTick(env, {
      db,
      lease,
      providers: [provider],
      now: () => started,
      writeSnapshot,
    });
    expect(result).toMatchObject({ ran: true, action: "move_to" });
    expect(committed[0]?.resident).toMatchObject({ station: "river" });
    expect(committed[0]?.events?.find((row) => row["kind"] === "walk")).toMatchObject({
      t_start: started.toISOString(),
    });
    const feed = LiveFeed.parse(writeSnapshot.mock.calls[0]?.[0]);
    expect(feed.snapshot.resident).toMatchObject({
      pose: genesis(17, started.getTime()).pos,
      station: "bed",
    });
    expect(feed.snapshot.resident.pose).not.toMatchObject({
      x: committed[0]?.resident?.["x"],
      z: committed[0]?.resident?.["z"],
    });
  });

  test("a publishing failure leaves the commit successful and emits a scrubbed diagnostic", async () => {
    const { calls, db, lease, provider } = wiring();
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const result = await runLiveTick(env, {
        db,
        lease,
        providers: [provider],
        now: () => started,
        writeSnapshot: async () => {
          calls.push("publish");
          throw new Error(`upload failed with ${env.SUPABASE_SERVICE_KEY}`);
        },
      });
      expect(result).toMatchObject({ ran: true, tick_id: 25 });
      expect(calls).toEqual(["acquire", "commit", "read", "publish", "release"]);
      expect(error).toHaveBeenCalledExactlyOnceWith({
        event: "snapshot_publish_failed",
        tick_id: 25,
        error: "upload failed with [redacted]",
      });
    } finally {
      error.mockRestore();
    }
  });

  test("failed commits never reach snapshot projection or hosting", async () => {
    const { calls, db, lease, provider, failCommit } = wiring();
    failCommit();
    const writeSnapshot = vi.fn();
    await expect(
      runLiveTick(env, { db, lease, providers: [provider], now: () => started, writeSnapshot }),
    ).rejects.toThrow("supabase /rest/v1/rpc/tick_commit failed");
    expect(calls).toEqual(["acquire", "commit", "failed-commit", "release"]);
    expect(writeSnapshot).not.toHaveBeenCalled();
  });

  test("does not start an upload near the tick lease deadline", async () => {
    const { calls, db, lease, provider } = wiring();
    const writeSnapshot = vi.fn();
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const nearDeadline = new Date(started.getTime() + 100_000);
    const now = vi.fn(() => nearDeadline).mockReturnValueOnce(started);
    try {
      const result = await runLiveTick(env, {
        db,
        lease,
        providers: [provider],
        now,
        writeSnapshot,
      });
      expect(result).toMatchObject({ ran: true, tick_id: 25 });
      expect(calls).toEqual(["acquire", "commit", "release"]);
      expect(writeSnapshot).not.toHaveBeenCalled();
      expect(error).toHaveBeenCalledExactlyOnceWith({
        event: "snapshot_publish_failed",
        tick_id: 25,
        error: "tick lease has insufficient time for snapshot publication",
      });
    } finally {
      error.mockRestore();
    }
  });
});
