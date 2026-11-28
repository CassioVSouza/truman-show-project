// 7-day simulated pipeline test (doc 06 section C): asserts daily budgets are respected, no state corruption,
// memories persist and are recalled across ticks, and every Resident prompt passes the leak test.
import { describe, expect, test } from "vitest";
import { DEFAULT_GOVERNOR, type Budget } from "../governor";
import type { FakeProvider } from "../llm";
import { PERSONA } from "../prompts/persona";
import {
  EMOTION_LABELS,
  FRAMING_WORDS,
  scanPrompt,
  strictHiddenNames,
  type LeakRules,
} from "../prompts/leak-scan";
import { FAKE_SECRETS, hiddenKeyNames } from "../prompts/fixtures/hidden";
import { MEMORY_CAP } from "../memory";
import { HISTORY_CAP, LESSON_CAP, QUESTION_CAP } from "./state";
import { makeAgent, simulate } from "./testkit";

const rules: LeakRules = {
  hiddenNames: strictHiddenNames(hiddenKeyNames()),
  secrets: Object.values(FAKE_SECRETS),
  framingWords: FRAMING_WORDS,
  emotionLabels: EMOTION_LABELS,
};

describe("7-day simulated pipeline (doc 06 section C)", () => {
  test("budgets respected, no corruption, memories recalled, zero leaks across 7 days", async () => {
    let agent: FakeProvider | undefined;
    const gov = DEFAULT_GOVERNOR;
    const { db, results } = await simulate({
      days: 7,
      stepMin: gov.tickMinutes,
      governor: gov,
      providers: (simDb) => [(agent = makeAgent(simDb))],
      tools: {
        webSearch: async (q) => ({
          ok: true,
          text: `Results for ${q}: rivers carve valleys over time.`,
          source_url: "https://example.org/rivers",
          bytes: 64,
          status: 200,
        }),
        readPage: async (url) => ({
          ok: true,
          text: "Water boils at a lower temperature on high ground.",
          source_url: url,
          bytes: 50,
          status: 200,
        }),
      },
    });

    expect(results).toHaveLength(7 * 480);

    // 1. Daily budgets NEVER exceeded on any UTC day
    const byDay = new Map<string, { llm: number; search: number; fetch: number }>();
    for (const p of db.payloads) {
      const b = p.kv?.["budget"] as Budget | undefined;
      if (!b) continue;
      const cur = byDay.get(b.day) ?? { llm: 0, search: 0, fetch: 0 };
      cur.llm = Math.max(cur.llm, b.llm_calls);
      cur.search = Math.max(cur.search, b.search_calls);
      cur.fetch = Math.max(cur.fetch, b.fetch_calls);
      byDay.set(b.day, cur);
    }
    expect(byDay.size).toBeGreaterThanOrEqual(7);
    for (const [day, u] of byDay) {
      expect(u.llm, `llm cap on ${day}`).toBeLessThanOrEqual(gov.maxLlmCallsDay);
      expect(u.search, `search cap on ${day}`).toBeLessThanOrEqual(gov.maxSearchDay);
      expect(u.fetch, `fetch cap on ${day}`).toBeLessThanOrEqual(gov.maxFetchDay);
    }

    // 2. No state corruption: finite numbers, caps respected, Resident stayed alive
    const mind = db.mind!;
    expect(mind).not.toBeNull();
    expect(mind.body.alive, mind.body.cause_of_death ?? undefined).toBe(true);
    expect(Number.isFinite(mind.world.t)).toBe(true);
    expect(Number.isFinite(mind.body.health)).toBe(true);
    expect(Number.isFinite(mind.organism.state.valence)).toBe(true);
    expect(mind.history.length).toBeLessThanOrEqual(HISTORY_CAP);
    expect(mind.lessons.length).toBeLessThanOrEqual(LESSON_CAP);
    expect(mind.questions.length).toBeLessThanOrEqual(QUESTION_CAP);
    expect(mind.memories.length).toBeGreaterThan(0);
    expect(mind.memories.length).toBeLessThanOrEqual(MEMORY_CAP);
    // Memories were actually recalled across ticks
    expect(mind.memories.some((m) => m.recall_count > 0)).toBe(true);
    // Memory rows were also emitted to tick_commit
    const emittedMemories = db.payloads.reduce((n, p) => n + (p.memories?.length ?? 0), 0);
    expect(emittedMemories).toBeGreaterThan(0);

    // 3. Every Resident prompt passes the leak test; Interpreter never sees PERSONA
    const calls = agent?.calls ?? [];
    const residentCalls = calls.filter((c) => c.role === "resident");
    const interpreterCalls = calls.filter((c) => c.role === "interpreter");
    expect(residentCalls.length).toBeGreaterThan(100);
    for (const c of residentCalls) {
      const full = `${c.system}\n${c.messages.map((m) => m.content).join("\n")}`;
      expect(scanPrompt(full, rules)).toEqual([]);
    }
    for (const c of interpreterCalls) {
      const full = `${c.system}\n${c.messages.map((m) => m.content).join("\n")}`;
      expect(full).not.toContain(PERSONA.slice(0, 60));
    }
  }, 90_000);
});
