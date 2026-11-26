import { describe, expect, test } from "vitest";
import {
  affectResonance,
  keywordScore,
  makeMemory,
  pruneMemories,
  recallMemories,
  recencyScore,
  tokenize,
  type AffectSnapshot,
  type MemoryItem,
} from "./index";

const CALM: AffectSnapshot = {
  valence: 0.3,
  arousal: 0.2,
  stress_load: 0.1,
  social_deprivation: 0.2,
  info_hunger: 0.3,
  pain: 0,
};

const STRESSED: AffectSnapshot = {
  valence: -0.7,
  arousal: 0.9,
  stress_load: 0.85,
  social_deprivation: 0.6,
  info_hunger: 0.2,
  pain: 0.7,
};

function mem(overrides: Partial<MemoryItem> & { id: number; text: string }): MemoryItem {
  return {
    created_t: 0,
    kind: "experience",
    importance: 0.5,
    affect: CALM,
    last_recalled_t: null,
    recall_count: 0,
    ...overrides,
  };
}

describe("Memory v1", () => {
  test("tokenize strips stop words and lightly stems", () => {
    const t = tokenize("The rivers are flowing faster and the berries grew.");
    expect(t.has("river")).toBe(true);
    expect(t.has("flow")).toBe(true);
    expect(t.has("fast")).toBe(false); // "faster" stays "faster"
    expect(t.has("faster")).toBe(true);
    expect(t.has("the")).toBe(false);
    expect(t.has("and")).toBe(false);
  });

  test("keywordScore ranks matching topics higher than unrelated memories", () => {
    const q = tokenize("boil water from the river");
    const mRiver = mem({ id: 1, text: "I boiled river water over the hearth fire." });
    const mWood = mem({ id: 2, text: "I stacked dry firewood near the cabin door." });
    expect(keywordScore(q, mRiver)).toBeGreaterThan(keywordScore(q, mWood));
    expect(keywordScore(q, mWood)).toBe(0);
  });

  test("forgetting curve decays older memories slower when importance or recall_count is higher", () => {
    const nowT = 48 * 60; // 48 hours later
    const plain = mem({ id: 1, text: "plain", created_t: 0, importance: 0.2, recall_count: 0 });
    const important = mem({
      id: 2,
      text: "important",
      created_t: 0,
      importance: 0.9,
      recall_count: 0,
    });
    const rehearsed = mem({
      id: 3,
      text: "rehearsed",
      created_t: 0,
      importance: 0.2,
      recall_count: 6,
    });
    const fresh = mem({
      id: 4,
      text: "fresh",
      created_t: nowT - 30,
      importance: 0.2,
      recall_count: 0,
    });
    expect(recencyScore(important, nowT)).toBeGreaterThan(recencyScore(plain, nowT));
    expect(recencyScore(rehearsed, nowT)).toBeGreaterThan(recencyScore(plain, nowT));
    expect(recencyScore(fresh, nowT)).toBeGreaterThan(recencyScore(important, nowT));
  });

  test("affectResonance is 1 for identical state and lower for opposite state", () => {
    expect(affectResonance(CALM, CALM)).toBeCloseTo(1, 5);
    expect(affectResonance(CALM, STRESSED)).toBeLessThan(0.5);
  });

  test("recallMemories blends keyword, recency, importance, and affect, and bumps recall_count", () => {
    const memories = [
      mem({
        id: 1,
        text: "I burned my hand near the hearth.",
        created_t: 100,
        importance: 0.6,
        affect: STRESSED,
      }),
      mem({
        id: 2,
        text: "I watched calm clouds drift over the clearing.",
        created_t: 100,
        importance: 0.6,
        affect: CALM,
      }),
      mem({
        id: 3,
        text: "I found sweet berries near the forest edge.",
        created_t: 100,
        importance: 0.9,
        affect: CALM,
      }),
    ];
    // Under stress with a fire query, memory 1 should rank first.
    const r1 = recallMemories(memories, {
      queryText: "hearth fire hurts my hand",
      affect: STRESSED,
      nowT: 200,
      limit: 2,
    });
    expect(r1.recalled).toHaveLength(2);
    expect(r1.recalled[0]!.id).toBe(1);
    expect(r1.lines[0]).toMatch(/^memory:1 /);
    // Recall bumped count and timestamp on recalled items only
    const updated1 = r1.updated.find((m) => m.id === 1)!;
    const untouched = r1.updated.find((m) => !r1.recalled.some((x) => x.id === m.id))!;
    expect(updated1.recall_count).toBe(1);
    expect(updated1.last_recalled_t).toBe(200);
    expect(untouched.recall_count).toBe(0);
    expect(untouched.last_recalled_t).toBeNull();
  });

  test("pruneMemories drops lowest-retention memories when exceeding cap", () => {
    const list: MemoryItem[] = [];
    for (let i = 1; i <= 10; i++) {
      list.push(
        makeMemory({
          id: i,
          created_t: i * 60,
          kind: "experience",
          text: `event ${i}`,
          importance: i <= 3 ? 0.95 : 0.1,
          affect: CALM,
        }),
      );
    }
    const kept = pruneMemories(list, 10 * 60, 5);
    expect(kept).toHaveLength(5);
    // High-importance memories 1, 2, 3 must survive pruning
    const ids = new Set(kept.map((m) => m.id));
    expect(ids.has(1)).toBe(true);
    expect(ids.has(2)).toBe(true);
    expect(ids.has(3)).toBe(true);
  });
});
