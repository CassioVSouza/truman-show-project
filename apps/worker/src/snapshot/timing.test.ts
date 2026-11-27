import { describe, expect, test } from "vitest";
import { DEFAULT_GOVERNOR, readBudget } from "../governor";
import { FakeProvider } from "../llm";
import { genesis } from "../tick/state";
import { nextDecisionTime, nextTickTime } from "./timing";

const MINUTE = 60_000;
const slot = Date.parse("2026-11-26T12:00:00.000Z");
const next = slot + 3 * MINUTE;
const cfg = DEFAULT_GOVERNOR;
const budget = readBudget({}, new Date(slot));
const providers = [new FakeProvider("fake", () => ({}))];

describe("public decision timing", () => {
  test("uses the nominal schedule through dispatch jitter and manual ticks", () => {
    expect(nextTickTime(slot + 19_495, slot, 3)).toBe(next);
    expect(nextTickTime(slot + 19_495, undefined, 3)).toBe(next);
    expect(nextTickTime(next + 1, slot, 3)).toBe(slot + 6 * MINUTE);
    const mind = { ...genesis(1, slot), last_decision_ms: slot + 19_495 };
    expect(nextDecisionTime(next, mind, budget, cfg, providers)).toBe(slot + 6 * MINUTE);
  });

  test("waits for the committed macro-action and rounds up to an eligible slot", () => {
    const mind = { ...genesis(1, slot), last_decision_ms: slot };
    mind.world = { ...mind.world, t: 7 * cfg.timeScale };
    expect(nextDecisionTime(next, mind, budget, cfg, providers)).toBe(slot + 9 * MINUTE);
    mind.world.t = 6 * cfg.timeScale;
    expect(nextDecisionTime(next, mind, budget, cfg, providers)).toBe(slot + 6 * MINUTE);
  });

  test("uses the budget just committed to anticipate thrifty cadence and paced allowance", () => {
    const mind = { ...genesis(1, slot), last_decision_ms: slot };
    expect(nextDecisionTime(next, mind, { ...budget, search_calls: 22 }, cfg, providers)).toBe(
      slot + 6 * MINUTE,
    );
    expect(
      nextDecisionTime(
        next,
        mind,
        { ...budget, llm_calls: 7 },
        { ...cfg, maxLlmCallsDay: 10 },
        providers,
      ),
    ).toBe(Date.parse("2026-11-26T15:03:00.000Z"));
  });

  test("predicts the next opportunity after a missed decision", () => {
    const mind = { ...genesis(1, slot), last_decision_ms: slot - 6 * MINUTE };
    expect(nextDecisionTime(next, mind, { ...budget, search_calls: 22 }, cfg, providers)).toBe(
      next,
    );
  });

  test("re-evaluates thrifty cadence at the UTC reset", () => {
    const lastDecision = Date.parse("2026-11-26T23:57:00.000Z");
    const midnight = lastDecision + 3 * MINUTE;
    const mind = { ...genesis(1, lastDecision), last_decision_ms: lastDecision };
    expect(nextDecisionTime(midnight, mind, { ...budget, search_calls: 22 }, cfg, providers)).toBe(
      midnight,
    );
  });

  test("has no estimate when idle, hibernating, dead, or all providers are exhausted", () => {
    const mind = genesis(1, slot);
    for (const unavailable of [
      { ...budget, llm_calls: cfg.maxLlmCallsDay },
      { ...budget, fail_streak: cfg.hardFailStreak },
      { ...budget, exhausted: ["fake"] },
    ]) {
      expect(nextDecisionTime(next, mind, unavailable, cfg, providers)).toBeNull();
    }
    mind.body = { ...mind.body, alive: false };
    expect(nextDecisionTime(next, mind, budget, cfg, providers)).toBeNull();
  });
});
