import { describe, expect, test } from "vitest";
import { Event } from "@truman/contracts";
import { LogWriter } from "../log";
import { FakeProvider, LLMError } from "../llm";
import { InMemoryLease } from "../governor";
import { MemoryRows } from "./memory-log";
import { runMindTick } from "./pipeline";
import { SimDb, makeAgent, simulate } from "./testkit";
import type { TickPayload } from "../db/types";

const DAYS = 3;
type Row = Record<string, unknown>;

describe("FakeProvider-driven life over several simulated days", async () => {
  const sim = await simulate({
    days: DAYS,
    tools: {
      webSearch: async () => ({
        ok: true,
        text: "Rivers form where rain gathers and runs downhill.",
        bytes: 50,
      }),
      readPage: async (u) => ({ ok: true, text: "A page about water.", source_url: u, bytes: 20 }),
    },
  });
  const { db, results } = sim;
  const ticks = Math.floor((DAYS * 1440) / 10);

  test("one load and exactly one commit per tick, nothing failed", () => {
    expect(results).toHaveLength(ticks);
    expect(db.loads).toBe(ticks);
    expect(db.payloads).toHaveLength(ticks);
    expect(db.payloads.every((p) => p.tick.ok)).toBe(true);
  });

  test("the Resident lives through the days with a coherent mix of decided and continuing ticks", () => {
    expect(db.mind?.body.alive).toBe(true);
    const decided = results.filter((r) => r.step === "decided");
    expect(decided.length).toBeGreaterThan(40);
    expect(results.some((r) => r.step === "continuing")).toBe(true);
    const types = new Set(decided.map((r) => r.action));
    for (const t of ["drink", "eat", "move_to", "rest", "write_journal"])
      expect(types.has(t), t).toBe(true);
    expect(types.size).toBeGreaterThanOrEqual(7);
  });

  test("every action carries thought, intent and expectation; every decision row is complete", () => {
    const actions = db.payloads
      .flatMap((p) => p.log_entries ?? [])
      .filter((e) => e["kind"] === "action");
    expect(actions.length).toBeGreaterThan(40);
    for (const a of actions) {
      const d = a["data"] as { action: Row };
      expect(String(d.action["thought"]).length).toBeGreaterThan(0);
      expect(String(d.action["intent"]).length).toBeGreaterThan(2);
      expect(String(d.action["expectation"]).length).toBeGreaterThan(2);
    }
    const decisions = db.payloads.flatMap((p) => p.decisions ?? []);
    expect(decisions.length).toBeGreaterThan(30);
    expect(
      decisions.every((d) => String(d["intent"]).length > 2 && String(d["expectation"]).length > 2),
    ).toBe(true);
    expect(decisions.filter((d) => d["outcome_review"] !== null).length).toBeGreaterThan(20);
  });

  test("causal links: thought -> action -> outcome -> appraisal inside each tick", () => {
    const p = db.payloads.find((x) => (x.log_entries ?? []).some((e) => e["kind"] === "appraisal"));
    expect(p).toBeDefined();
    const rows = p!.log_entries!;
    const byRef = new Map(rows.map((r) => [r["ref"], r]));
    const appraisal = rows.find((r) => r["kind"] === "appraisal")!;
    const outcome = byRef.get(appraisal["caused_by_ref"])!;
    expect(outcome["kind"]).toBe("perception");
    const action = byRef.get(outcome["caused_by_ref"])!;
    expect(action["kind"]).toBe("action");
    expect(byRef.get(action["caused_by_ref"])!["kind"]).toBe("thought");
  });

  test("traces for every LLM call, budgets respected, Interpreter runs only for meaningful stimuli", () => {
    const traces = db.payloads.flatMap((p) => p.llm_traces ?? []);
    const roles = new Set(traces.map((t) => t["role"]));
    expect(roles.has("resident")).toBe(true);
    expect(roles.has("interpreter")).toBe(true);
    const interp = traces.filter((t) => t["role"] === "interpreter").length;
    expect(interp).toBeGreaterThan(0);
    expect(interp).toBeLessThan(traces.length / 2);
    const perTick = db.payloads.map((p) => (p.llm_traces ?? []).length);
    expect(Math.max(...perTick)).toBeLessThanOrEqual(6); // 2 db + <= 6 llm: far below 50 subrequests
    const budget = db.kv["budget"] as { llm_calls: number };
    expect(budget.llm_calls).toBeGreaterThan(0);
  });

  test("viewer events satisfy the contract", () => {
    const evs = db.payloads.flatMap((p) => p.events ?? []);
    expect(evs.length).toBeGreaterThan(50);
    evs.slice(0, 400).forEach((e, i) => {
      const r = Event.safeParse({ ...e, seq: i, log_id: null });
      expect(r.success, JSON.stringify(e) + JSON.stringify(r.error?.issues)).toBe(true);
    });
  });

  test("the persisted state is plain JSON and the resident row is updated", () => {
    expect(() => JSON.stringify(db.kv["mind"])).not.toThrow();
    expect(db.resident?.["status"]).toBe("running");
    expect(db.resident?.["vitals"]).toBeDefined();
  });
});

describe("fallback and failure handling", () => {
  const baseDeps = (db: SimDb, providers: FakeProvider[]) => ({
    db,
    log: new LogWriter(),
    rows: new MemoryRows(),
    providers,
    now: () => new Date("2026-03-01T06:30:00Z"),
  });

  test("a refusal moves to the next provider, is traced and logged, never rewritten", async () => {
    const db = new SimDb();
    const refuser = new FakeProvider(
      "gemini",
      new LLMError("Refused", "blocked", { finish_reason: "SAFETY", raw: "I cannot" }),
    );
    const backup = makeAgent(db);
    const r = await runMindTick(baseDeps(db, [refuser, backup]));
    expect(r.step).toBe("decided");
    const p = db.payloads[0] as TickPayload;
    const traces = p.llm_traces ?? [];
    expect(traces[0]).toMatchObject({ provider: "gemini", ok: false, finish_reason: "SAFETY" });
    expect(traces[1]).toMatchObject({ ok: true });
    expect(
      (p.log_entries ?? []).some((e) => e["kind"] === "error" && /refusal/.test(String(e["text"]))),
    ).toBe(true);
  });

  test("fallbacks count toward paced allowance and a paced wait stays running", async () => {
    const db = new SimDb();
    db.kv["budget"] = { day: "2026-03-01", llm_calls: 10 };
    const busyProvider = new FakeProvider("gemini", new LLMError("RateLimited", "quota waiting"));
    const backup = makeAgent(db);
    const run = (at: string) =>
      runMindTick({ ...baseDeps(db, [busyProvider, backup]), now: () => new Date(at) });

    const first = await run("2026-03-01T00:01:00Z");
    expect(first).toMatchObject({ llm_calls: 1 });
    expect(backup.calls).toHaveLength(0);
    expect(db.kv["budget"]).toMatchObject({ llm_calls: 11 });

    const next = await run("2026-03-01T00:04:00Z");
    expect(next).toMatchObject({ mode: "thrifty", step: "continuing", llm_calls: 0 });
    expect(db.resident?.["status"]).toBe("running");
  });

  test("invalid JSON gets one repair retry on the same provider", async () => {
    const db = new SimDb();
    const good = {
      action: {
        type: "think",
        thought: "Where am I?",
        intent: "Take stock.",
        expectation: "I will see.",
      },
    };
    const p = new FakeProvider("gemini").enqueue("not json at all", good);
    const r = await runMindTick(baseDeps(db, [p]));
    expect(r.step).toBe("decided");
    expect(p.calls).toHaveLength(2);
    expect(p.calls[1]!.messages.at(-1)!.content).toMatch(/could not be used/);
  });

  test("all providers failing gives a degraded idle tick, not a crash", async () => {
    const db = new SimDb();
    const down = new FakeProvider("gemini", new LLMError("Unavailable", "down"));
    const r = await runMindTick(baseDeps(db, [down]));
    expect(r.step).toBe("degraded");
    expect(db.payloads[0]!.tick.ok).toBe(true);
    expect(db.resident?.["status"]).toBe("degraded");
  });

  test("quota exhaustion is remembered for the day (provider skipped next tick)", async () => {
    const db = new SimDb();
    const a = new FakeProvider("gemini", new LLMError("QuotaExhausted", "per day"));
    const b = makeAgent(db);
    await runMindTick(baseDeps(db, [a, b]));
    expect((db.kv["budget"] as { exhausted: string[] }).exhausted).toContain("gemini");
    const before = a.calls.length;
    await runMindTick({ ...baseDeps(db, [a, b]), now: () => new Date("2026-03-01T06:40:00Z") });
    expect(a.calls.length).toBe(before);
  });

  test("kill switch skips the tick with a logged row; a held lease blocks overlapping runs", async () => {
    const db = new SimDb();
    db.kv["kill_switch"] = true;
    const agent = makeAgent(db);
    const r = await runMindTick(baseDeps(db, [agent]));
    expect(r.ran).toBe(false);
    expect(agent.calls).toHaveLength(0);
    expect(db.payloads).toHaveLength(1);
    db.kv["kill_switch"] = false;
    const lease = new InMemoryLease();
    await lease.acquire("someone-else", new Date("2026-03-01T06:30:00Z"), 120000);
    const r2 = await runMindTick({ ...baseDeps(db, [agent]), lease });
    expect(r2.reason).toBe("lease_held");
    expect(agent.calls).toHaveLength(0);
  });

  test("a thrown tick rethrows (and tries to commit one failed row)", async () => {
    const db = new SimDb();
    db.loadState = async () => {
      throw new Error("db down");
    };
    await expect(runMindTick(baseDeps(db, [makeAgent(db)]))).rejects.toThrow("db down");
    expect(db.payloads[0]?.tick.mode).toBe("failed");
  });
});
