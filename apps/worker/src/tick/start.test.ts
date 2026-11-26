import { expect, test } from "vitest";
import { runLiveTick } from "../index";
import { InMemoryLease } from "../governor";
import { FakeProvider } from "../llm";
import { startResident } from "./start";
import { SimDb } from "./testkit";
import type { MindState } from "./state";

test("the first scheduled tick uses the stored birth, body, and empty memory", async () => {
  const born = new Date("2026-11-26T12:00:00Z");
  const tickAt = new Date("2026-11-26T12:10:00Z");
  const db = new SimDb();
  db.resident = null;
  db.kv = {};
  const lease = new InMemoryLease();
  let starts = 0;
  const rpc = async (name: string, args: Record<string, unknown>) => {
    starts++;
    expect(name).toBe("admin_start_resident");
    expect(args["p_holder"]).toBe(lease.row?.holder);
    const mind = args["p_mind"] as MindState;
    expect(args["p_born_at"]).toBe(born.toISOString());
    expect(args["p_vitals"]).toMatchObject({ alive: true, health: 100 });
    expect(mind).toMatchObject({
      born_ms: born.getTime(),
      station: "bed",
      world: { t: 0, seed: mind.seed },
      physiology: { heart_rate: expect.any(Number) },
      history: [],
      memories: [],
      lessons: [],
      questions: [],
      goals: [],
      beliefs: [],
    });
    expect(mind.inventory).toBeTruthy();
    db.kv = { mind, world_seed: mind.seed };
    db.resident = { id: 1, born_at: args["p_born_at"], status: "running" };
    return "started";
  };
  await expect(startResident({ rpc }, lease, () => born)).resolves.toBe("started");
  expect(starts).toBe(1);
  expect(lease.row).toBeNull();

  const fake = new FakeProvider("fake", {
    action: {
      type: "think",
      thought: "The cabin is quiet.",
      intent: "Take stock of the room.",
      expectation: "I will notice what is near.",
    },
  });
  const result = await runLiveTick(
    { SUPABASE_URL: "https://example.test", SUPABASE_SERVICE_KEY: "test-key-not-real" },
    { db, lease, now: () => tickAt, providers: [fake] },
  );
  expect(result).toMatchObject({ ran: true, step: "decided", action: "think", llm_calls: 1 });
  expect(db.mind).toMatchObject({
    born_ms: born.getTime(),
    seed: db.kv["world_seed"],
    action_seq: 1,
  });
  expect(db.payloads).toHaveLength(1);
});

test("a held tick lease prevents concurrent start and a failed start releases its lease", async () => {
  const now = () => new Date("2026-11-26T12:00:00Z");
  const lease = new InMemoryLease();
  await lease.acquire("tick", now(), 120_000);
  const db = { rpc: async () => Promise.reject(new Error("test DB failure")) };
  await expect(startResident(db, lease, now)).resolves.toBe("busy");
  expect(lease.row?.holder).toBe("tick");
  await lease.release("tick");
  await expect(startResident(db, lease, now)).rejects.toThrow("test DB failure");
  expect(lease.row).toBeNull();
});
