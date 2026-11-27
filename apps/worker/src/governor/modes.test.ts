import { describe, expect, test } from "vitest";
import {
  DEFAULT_GOVERNOR,
  InMemoryLease,
  applyUsage,
  canEarlyTick,
  governorConfigFromEnv,
  leaseFree,
  pickMode,
  readBudget,
} from "./index";

const now = new Date("2026-03-01T12:00:00Z");
const kvWith = (b: Partial<Record<string, unknown>>) => ({
  budget: {
    day: "2026-03-01",
    llm_calls: 0,
    search_calls: 0,
    fetch_calls: 0,
    early_ticks: 0,
    fail_streak: 0,
    exhausted: [],
    ...b,
  },
});

describe("governor modes (doc 05)", () => {
  test("normal under 70% of every budget", () => {
    const p = pickMode(kvWith({ llm_calls: 100 }), now);
    expect(p).toMatchObject({
      mode: "normal",
      allowDecide: true,
      allowInterpreter: true,
      decisionIntervalMin: 3,
    });
  });
  test("thrifty at 70%: interval doubles, Interpreter replaced by rule tables", () => {
    const p = pickMode(kvWith({ llm_calls: 150 }), now);
    expect(p).toMatchObject({ mode: "thrifty", allowInterpreter: false, decisionIntervalMin: 6 });
  });
  test("reading_only when the search budget is out", () => {
    const p = pickMode(kvWith({ search_calls: 30 }), now);
    expect(p).toMatchObject({
      mode: "reading_only",
      allowSearch: false,
      allowFetch: true,
      allowDecide: true,
    });
  });
  test("idle when the LLM budget is out: engine-only life", () => {
    const p = pickMode(kvWith({ llm_calls: 200 }), now);
    expect(p).toMatchObject({ mode: "idle", allowDecide: false, llmCallsLeft: 0 });
  });
  test("an early burst is paced through the UTC day without counting as exhaustion", () => {
    const budget = kvWith({ llm_calls: 10 });
    expect(pickMode(budget, new Date("2026-03-01T00:00:00Z"))).toMatchObject({
      mode: "thrifty",
      allowDecide: false,
      llmCallsLeft: 0,
    });
    expect(pickMode(budget, new Date("2026-03-01T00:03:00Z"))).toMatchObject({
      mode: "normal",
      allowDecide: true,
      llmCallsLeft: 1,
    });
    const end = new Date("2026-03-01T23:59:00Z");
    expect(pickMode(kvWith({ llm_calls: 199 }), end).llmCallsLeft).toBe(1);
    expect(pickMode({}, end).llmCallsLeft).toBe(DEFAULT_GOVERNOR.maxLlmCallsDay);
    const reset = new Date("2026-03-02T00:00:00Z");
    expect(pickMode(kvWith({ llm_calls: 200 }), reset)).toMatchObject({
      mode: "normal",
      allowDecide: true,
      llmCallsLeft: 10,
    });
  });
  test("hibernating after a streak of failed ticks", () => {
    expect(pickMode(kvWith({ fail_streak: 6 }), now).mode).toBe("hibernating");
    expect(pickMode(kvWith({ fail_streak: 5 }), now).mode).toBe("normal");
  });
  test("counters and quota exhaustion reset at the UTC day boundary; failure streak survives", () => {
    const b = readBudget(
      kvWith({ llm_calls: 150, exhausted: ["gemini"], fail_streak: 2 }),
      new Date("2026-03-02T00:01:00Z"),
    );
    expect(b).toMatchObject({ day: "2026-03-02", llm_calls: 0, exhausted: [], fail_streak: 2 });
  });
  test("malformed budget rows fall back to a fresh day", () => {
    expect(readBudget({ budget: "oops" }, now).llm_calls).toBe(0);
    expect(readBudget({ budget: { day: "2026-03-01", llm_calls: "x" } }, now).llm_calls).toBe(0);
  });
  test("usage accumulates, ok resets the streak, failure extends it", () => {
    let b = readBudget({}, now);
    b = applyUsage(b, { llm_calls: 3, search_calls: 1, ok: true, exhausted: ["gemini"] });
    expect(b).toMatchObject({
      llm_calls: 3,
      search_calls: 1,
      exhausted: ["gemini"],
      fail_streak: 0,
    });
    expect(applyUsage(b, { ok: false }).fail_streak).toBe(1);
  });
  test("early-wake ticks are capped per day", () => {
    expect(canEarlyTick(readBudget(kvWith({ early_ticks: 11 }), now))).toBe(true);
    expect(canEarlyTick(readBudget(kvWith({ early_ticks: 12 }), now))).toBe(false);
  });
  test("config reads env overrides and ignores garbage", () => {
    expect(governorConfigFromEnv({ MAX_LLM_CALLS_DAY: "50", MAX_SEARCH_DAY: "abc" })).toMatchObject(
      {
        maxLlmCallsDay: 50,
        maxSearchDay: DEFAULT_GOVERNOR.maxSearchDay,
        timeScale: 4,
      },
    );
  });
  test("TIME_SCALE defaults to 4, clamps to 1..24, and ignores invalid values", () => {
    expect(governorConfigFromEnv({}).timeScale).toBe(4);
    expect(governorConfigFromEnv({ TIME_SCALE: "1" }).timeScale).toBe(1);
    expect(governorConfigFromEnv({ TIME_SCALE: "8" }).timeScale).toBe(8);
    expect(governorConfigFromEnv({ TIME_SCALE: "0.25" }).timeScale).toBe(1);
    expect(governorConfigFromEnv({ TIME_SCALE: "99" }).timeScale).toBe(24);
    expect(governorConfigFromEnv({ TIME_SCALE: "0" }).timeScale).toBe(4);
    expect(governorConfigFromEnv({ TIME_SCALE: "-4" }).timeScale).toBe(4);
    expect(governorConfigFromEnv({ TIME_SCALE: "fast" }).timeScale).toBe(4);
  });
});

describe("lease", () => {
  test("a held lease blocks a second run until it expires or is released", async () => {
    const l = new InMemoryLease();
    expect(await l.acquire("a", now, 1000)).toBe(true);
    expect(await l.acquire("b", new Date(now.getTime() + 500), 1000)).toBe(false);
    expect(await l.acquire("b", new Date(now.getTime() + 1500), 1000)).toBe(true);
    await l.release("a"); // not the holder: no effect
    expect(await l.acquire("c", new Date(now.getTime() + 1600), 1000)).toBe(false);
    await l.release("b");
    expect(await l.acquire("c", new Date(now.getTime() + 1700), 1000)).toBe(true);
  });
  test("leaseFree on kv rows", () => {
    expect(leaseFree(undefined, now)).toBe(true);
    expect(leaseFree({ holder: "x", expires_at: "2026-03-01T12:05:00Z" }, now)).toBe(false);
    expect(leaseFree({ holder: "x", expires_at: "garbage" }, now)).toBe(true);
  });
});
