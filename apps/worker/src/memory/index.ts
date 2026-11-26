// Memory v1 (doc 06 item 6, doc 08): encoding with appraisal + affect snapshot, recall by FTS/keyword +
// recency (forgetting curve) + importance + affective/state resonance, and forgetting/pruning. Pure, no I/O.
import type { OrganismState } from "@truman/organism";

export type MemoryKind = "discovery" | "experience" | "dream" | "lesson" | "reflection";

export interface AffectSnapshot {
  valence: number;
  arousal: number;
  stress_load: number;
  social_deprivation: number;
  info_hunger: number;
  pain: number;
}

export interface MemoryItem {
  id: number;
  /** World minutes since birth when encoded. */
  created_t: number;
  kind: MemoryKind;
  text: string;
  source_url?: string | null;
  /** 0..1 */
  importance: number;
  topic?: string | null;
  /** Hidden affect snapshot at encoding, used for state-dependent recall. */
  affect: AffectSnapshot;
  last_recalled_t: number | null;
  recall_count: number;
}

export const MEMORY_CAP = 64;
const MAX_MEMORY_TEXT = 240;

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "that",
  "this",
  "with",
  "from",
  "have",
  "was",
  "were",
  "are",
  "you",
  "your",
  "not",
  "but",
  "all",
  "can",
  "had",
  "her",
  "his",
  "one",
  "our",
  "out",
  "day",
  "get",
  "has",
  "him",
  "how",
  "man",
  "new",
  "now",
  "old",
  "see",
  "two",
  "way",
  "who",
  "did",
  "its",
  "let",
  "put",
  "say",
  "she",
  "too",
  "use",
  "will",
  "what",
  "when",
  "where",
  "which",
  "into",
  "some",
  "there",
  "then",
  "than",
  "them",
  "they",
  "been",
  "more",
  "very",
  "just",
  "about",
  "still",
  "around",
  "ahead",
  "left",
  "right",
]);

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

export function affectSnapshot(o: OrganismState): AffectSnapshot {
  return {
    valence: clamp(o.valence, -1, 1),
    arousal: clamp(o.arousal, 0, 1),
    stress_load: clamp(o.stress_load, 0, 1),
    social_deprivation: clamp(o.social_deprivation, 0, 1),
    info_hunger: clamp(o.info_hunger, 0, 1),
    pain: clamp(o.pain, 0, 1),
  };
}

/** Simple light stemmer + stop-word filter for FTS-like keyword matching in pure TS. */
export function tokenize(text: string): Set<string> {
  const out = new Set<string>();
  const words = text.toLowerCase().match(/[a-z]{3,}/g);
  if (!words) return out;
  for (let w of words) {
    if (STOP_WORDS.has(w)) continue;
    if (w.length > 5 && w.endsWith("ing")) w = w.slice(0, -3);
    else if (w.length > 4 && w.endsWith("ed")) w = w.slice(0, -2);
    else if (w.length > 4 && w.endsWith("es")) w = w.slice(0, -2);
    else if (w.length > 3 && w.endsWith("s")) w = w.slice(0, -1);
    if (w.length >= 3 && !STOP_WORDS.has(w)) out.add(w);
  }
  return out;
}

export function keywordScore(queryTokens: Set<string>, mem: MemoryItem): number {
  if (queryTokens.size === 0) return 0;
  const memTokens = tokenize(`${mem.text} ${mem.topic ?? ""}`);
  if (memTokens.size === 0) return 0;
  let hits = 0;
  for (const t of queryTokens) if (memTokens.has(t)) hits++;
  if (hits === 0) return 0;
  // Blend query coverage and memory density so short specific memories score well.
  const denom = Math.sqrt(queryTokens.size * memTokens.size);
  return clamp(hits / Math.max(1, denom), 0, 1);
}

/** Ebbinghaus-like forgetting curve: importance and repeated recall slow down decay. */
export function recencyScore(mem: MemoryItem, nowT: number): number {
  const refT = mem.last_recalled_t ?? mem.created_t;
  const ageHours = Math.max(0, (nowT - refT) / 60);
  const stabilityHours =
    24 * (1 + 2.5 * clamp(mem.importance, 0, 1) + 0.6 * Math.min(10, mem.recall_count));
  return Math.exp(-ageHours / stabilityHours);
}

/** Affective / state-dependent resonance between encoding state and current state (0..1). */
export function affectResonance(a: AffectSnapshot, b: AffectSnapshot): number {
  const dValence = Math.abs(a.valence - b.valence) / 2;
  const dArousal = Math.abs(a.arousal - b.arousal);
  const dStress = Math.abs(a.stress_load - b.stress_load);
  const dSocial = Math.abs(a.social_deprivation - b.social_deprivation);
  const dInfo = Math.abs(a.info_hunger - b.info_hunger);
  const dPain = Math.abs(a.pain - b.pain);
  const avgDiff = (dValence + dArousal + dStress + dSocial + dInfo + dPain) / 6;
  return clamp(1 - avgDiff, 0, 1);
}

export function scoreMemory(
  mem: MemoryItem,
  queryTokens: Set<string>,
  currentAffect: AffectSnapshot,
  nowT: number,
): number {
  const kw = keywordScore(queryTokens, mem);
  const rec = recencyScore(mem, nowT);
  const imp = clamp(mem.importance, 0, 1);
  const aff = affectResonance(mem.affect, currentAffect);
  return 0.35 * kw + 0.25 * rec + 0.25 * imp + 0.15 * aff;
}

export interface RecallOptions {
  queryText: string;
  affect: AffectSnapshot;
  nowT: number;
  limit: number;
}

export interface RecallResult {
  recalled: MemoryItem[];
  /** Updated full memory array with `last_recalled_t` and `recall_count` bumped for recalled items. */
  updated: MemoryItem[];
  /** Resident-facing prose lines (each prefixed with `memory:<id>`). */
  lines: string[];
}

export function recallMemories(memories: MemoryItem[], opts: RecallOptions): RecallResult {
  if (memories.length === 0 || opts.limit <= 0) {
    return { recalled: [], updated: memories, lines: [] };
  }
  const queryTokens = tokenize(opts.queryText);
  const scored = memories.map((m) => ({
    m,
    score: scoreMemory(m, queryTokens, opts.affect, opts.nowT),
  }));
  scored.sort((a, b) => b.score - a.score || b.m.id - a.m.id);
  const picked = scored.slice(0, opts.limit).map((x) => x.m);
  const pickedIds = new Set(picked.map((m) => m.id));
  const updated = memories.map((m) =>
    pickedIds.has(m.id)
      ? { ...m, last_recalled_t: opts.nowT, recall_count: m.recall_count + 1 }
      : m,
  );
  const recalled = updated.filter((m) => pickedIds.has(m.id));
  // Preserve ranked order
  const byId = new Map(recalled.map((m) => [m.id, m]));
  const ordered = picked.map((m) => byId.get(m.id)!);
  const lines = ordered.map((m) => `memory:${m.id} ${m.text}`);
  return { recalled: ordered, updated, lines };
}

export interface NewMemoryDraft {
  id: number;
  created_t: number;
  kind: MemoryKind;
  text: string;
  source_url?: string | null;
  importance: number;
  topic?: string | null;
  affect: AffectSnapshot;
}

export function makeMemory(d: NewMemoryDraft): MemoryItem {
  const clean = d.text.replace(/\s+/g, " ").trim().slice(0, MAX_MEMORY_TEXT);
  return {
    id: d.id,
    created_t: d.created_t,
    kind: d.kind,
    text: clean,
    source_url: d.source_url ?? null,
    importance: clamp(d.importance, 0, 1),
    topic: d.topic ?? null,
    affect: d.affect,
    last_recalled_t: null,
    recall_count: 0,
  };
}

/** Retention-based forgetting: when above `cap`, drop lowest-retention memories. */
export function pruneMemories(
  memories: MemoryItem[],
  nowT: number,
  cap: number = MEMORY_CAP,
): MemoryItem[] {
  if (memories.length <= cap) return memories;
  const ranked = memories.map((m) => ({
    m,
    retention:
      0.45 * clamp(m.importance, 0, 1) +
      0.35 * recencyScore(m, nowT) +
      0.2 * Math.min(1, m.recall_count / 5),
  }));
  ranked.sort((a, b) => b.retention - a.retention || b.m.id - a.m.id);
  return ranked.slice(0, cap).map((x) => x.m);
}

/** Formats a MemoryItem for the `memories` table in `tick_commit`. */
export function toMemoryRow(
  mem: MemoryItem,
  bodySnapshot: Record<string, unknown>,
  appraisal: Record<string, unknown> | null = null,
): Record<string, unknown> {
  return {
    kind: mem.kind,
    text: mem.text,
    source_url: mem.source_url ?? null,
    importance: mem.importance,
    topic: mem.topic ?? null,
    appraisal,
    body_snapshot: { affect: mem.affect, ...bodySnapshot },
  };
}
