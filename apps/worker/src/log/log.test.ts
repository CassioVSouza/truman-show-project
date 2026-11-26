import { describe, expect, test } from "vitest";
import { LogKind } from "@truman/contracts";
import { FakeDb } from "../db/fake";
import type { TickPayload } from "../db/types";
import { LIFE_KINDS, LogWriter, MAX_ENTRIES_PER_TICK, categoryOf, idOf } from "./index";

describe("log writer", () => {
  test("refs, causal links, category derived from kind, defaults", () => {
    const log = new LogWriter();
    const a = log.add({ kind: "perception", text: "a warm light" });
    const b = log.add({ kind: "thought", text: "it moves", causedBy: a });
    const c = log.add({ kind: "llm_trace", text: "call", causedBy: b, data: { tokens: 3 } });
    const d = log.add({ kind: "action", text: "look", causedBy: 41 });
    expect([a, b, c, d]).toEqual(["e1", "e2", "e3", "e4"]);
    const rows = log.entries();
    expect(rows[1]).toMatchObject({
      kind: "thought",
      category: "life",
      caused_by_ref: "e1",
      lang: "en",
    });
    expect(rows[2]).toMatchObject({ category: "lab", caused_by_ref: "e2", data: { tokens: 3 } });
    expect(rows[3]).toMatchObject({ caused_by: 41 });
    expect(rows[0]).not.toHaveProperty("caused_by_ref");
  });
  test("every contract kind has a category, and entries can never be written hidden", () => {
    for (const k of LogKind.options) expect(categoryOf(k)).toBe(LIFE_KINDS.has(k) ? "life" : "lab");
    const log = new LogWriter();
    log.add({ kind: "thought", text: "x", data: { hidden: true } });
    expect(log.entries()[0]).not.toHaveProperty("hidden");
  });
  test("a cause must precede its effect; ids must be sane; kinds must exist", () => {
    const log = new LogWriter();
    expect(() => log.add({ kind: "thought", text: "x", causedBy: "e9" })).toThrow(/unknown cause/);
    expect(() => log.add({ kind: "thought", text: "x", causedBy: -1 })).toThrow();
    expect(() => log.add({ kind: "thought", text: "x", causedBy: 1.5 })).toThrow();
    expect(() => log.add({ kind: "bogus" as never, text: "x" })).toThrow();
    expect(log.size).toBe(0);
  });
  test("secrets are scrubbed from text and nested data; content is not filtered", () => {
    const log = new LogWriter((s) => s.split("SECRET-VALUE-123").join("[redacted]"));
    log.add({
      kind: "error",
      text: "boom SECRET-VALUE-123",
      data: { a: ["SECRET-VALUE-123"], "k-SECRET-VALUE-123": { b: "x" } },
    });
    log.add({ kind: "thought", text: "any words at all, however dark or odd" });
    const [e, t] = log.entries();
    expect(JSON.stringify(e)).not.toContain("SECRET-VALUE-123");
    expect(e).toMatchObject({ text: "boom [redacted]" });
    expect(t).toMatchObject({ text: "any words at all, however dark or odd" });
  });
  test("data is copied: later mutation cannot alter the log", () => {
    const log = new LogWriter();
    const data = { n: 1 };
    log.add({ kind: "thought", text: "x", data });
    data.n = 2;
    const rows = log.entries();
    (rows[0] as { text: string }).text = "tampered";
    expect(log.entries()[0]).toMatchObject({ text: "x", data: { n: 1 } });
  });
  test("per-tick cap", () => {
    const log = new LogWriter();
    for (let i = 0; i < MAX_ENTRIES_PER_TICK; i++) log.add({ kind: "thought", text: "x" });
    expect(() => log.add({ kind: "thought", text: "x" })).toThrow(/more than/);
  });
  test("attach puts everything into the single commit payload, after existing entries", async () => {
    const db = new FakeDb();
    const log = new LogWriter();
    const a = log.add({ kind: "perception", text: "p" });
    log.add({ kind: "thought", text: "t", causedBy: a });
    const payload: TickPayload = {
      tick: {
        started_at: "2026-01-01T00:00:00Z",
        ended_at: "2026-01-01T00:00:01Z",
        mode: "normal",
        provider: null,
        ok: true,
        error: null,
      },
      log_entries: [{ kind: "tick", category: "lab", text: "tick", data: {} }],
    };
    log.attach(payload);
    await db.commitTick(payload);
    expect(db.commits).toHaveLength(1);
    expect(payload.log_entries!.map((r) => r["kind"])).toEqual(["tick", "perception", "thought"]);
  });
  test("idOf resolves committed refs for a later tick and fails on unknown refs", () => {
    expect(idOf({ e1: 77 }, "e1")).toBe(77);
    expect(() => idOf({}, "e1")).toThrow(/not committed/);
  });
});
