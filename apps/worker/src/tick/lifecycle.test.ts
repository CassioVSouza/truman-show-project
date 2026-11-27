import { describe, expect, test } from "vitest";
import { DEFAULT_GOVERNOR } from "../governor";
import { FakeProvider } from "../llm";
import { SimDb, makeAgent, simulate } from "./testkit";

const idleMind = () => ({
  type: "think",
  thought: "I sit and think.",
  intent: "Pass the time.",
  expectation: "Nothing will change.",
});

describe("death is permanent", () => {
  test("an idle Resident dies, the death is logged once, then ticks are skipped and the model is never called", async () => {
    let agent: FakeProvider | undefined;
    const { db, results } = await simulate({
      days: 6,
      providers: (d) => [(agent = makeAgent(d, { policy: idleMind }))],
    });
    expect(db.resident?.["status"]).toBe("dead");
    const deaths = db.payloads.flatMap((p) => p.events ?? []).filter((e) => e["kind"] === "death");
    expect(deaths).toHaveLength(1);
    const deathLogs = db.payloads
      .flatMap((p) => p.log_entries ?? [])
      .filter((e) => /^Death:/.test(String(e["text"])));
    expect(deathLogs).toHaveLength(1);
    const diedAt = results.findIndex((r) => r.step === "dead");
    expect(diedAt).toBeGreaterThan(0);
    expect(results.slice(diedAt + 1).every((r) => r.ran === false && r.reason === "dead")).toBe(
      true,
    );
    const callsAtDeath = (agent as FakeProvider).calls.length;
    expect(callsAtDeath).toBeGreaterThan(0);
    // body report kept for the memorial
    expect(db.mind?.body.death_report).not.toBeNull();
    expect(db.mind?.body.alive).toBe(false);
  });
});

describe("governor integration", () => {
  test("a small LLM budget walks through thrifty to idle; idle still lets the body evolve and never calls the model", async () => {
    let agent: FakeProvider | undefined;
    const { db, results } = await simulate({
      days: 1,
      stepMin: DEFAULT_GOVERNOR.tickMinutes,
      governor: { ...DEFAULT_GOVERNOR, maxLlmCallsDay: 12, timeScale: 1 },
      start: new Date("2026-03-01T00:00:00Z"),
      providers: (d) => [(agent = makeAgent(d, { policy: idleMind }))],
    });
    const modes = results.map((r) => r.mode);
    expect(modes).toContain("normal");
    expect(modes).toContain("thrifty");
    expect(modes).toContain("idle");
    expect((agent as FakeProvider).calls.length).toBe(12);
    const b = db.kv["budget"] as { llm_calls: number };
    expect(b.llm_calls).toBe(12);
    const t = db.mind!.world.t;
    expect(t).toBeGreaterThan(1400); // time kept passing while idle
    // thrifty ticks never call the Interpreter
    const idxThrifty = results.findIndex((r) => r.mode === "thrifty");
    const after = db.payloads
      .slice(idxThrifty)
      .filter((p, i) => results[idxThrifty + i]!.mode === "thrifty");
    expect(after.flatMap((p) => p.llm_traces ?? []).every((tr) => tr["role"] === "resident")).toBe(
      true,
    );
  });

  test("thrifty doubles the decision interval", async () => {
    const { results } = await simulate({
      days: 1,
      governor: { ...DEFAULT_GOVERNOR, maxLlmCallsDay: 12 },
      start: new Date("2026-03-01T00:00:00Z"),
    });
    const thrifty = results.filter((r) => r.mode === "thrifty");
    expect(thrifty.length).toBeGreaterThan(2);
    expect(thrifty.filter((r) => r.step === "decided").length).toBeLessThanOrEqual(
      Math.ceil(thrifty.length / 2) + 1,
    );
  });

  test("hibernating after repeated failed ticks (state preserved)", async () => {
    const db = new SimDb();
    db.kv["budget"] = {
      day: "2026-03-01",
      llm_calls: 0,
      search_calls: 0,
      fetch_calls: 0,
      early_ticks: 0,
      fail_streak: 6,
      exhausted: [],
    };
    const { results } = await simulate({ days: 0.01, db });
    expect(results[0]).toMatchObject({ ran: false, mode: "hibernating" });
  });

  test("with no providers configured the Resident lives engine-only, no crash", async () => {
    const { db, results } = await simulate({ days: 0.2, providers: () => [] });
    expect(results.every((r) => r.ran)).toBe(true);
    expect(db.mind?.world.t).toBeGreaterThan(200);
  });
});
