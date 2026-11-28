import { describe, expect, test } from "vitest";
import { runTranslateBatch } from "./index";
import type { Translator } from "../api/translate";

class Fake {
  calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  constructor(private answers: Record<string, unknown>) {}
  async rpc(name: string, args: Record<string, unknown> = {}): Promise<unknown> {
    this.calls.push({ name, args });
    const a = this.answers[name];
    return typeof a === "function" ? (a as (x: unknown) => unknown)(args) : a;
  }
  n(name: string) {
    return this.calls.filter((c) => c.name === name).length;
  }
}
const ok: Translator = { engine: "fake", translate: async (t) => `PT(${t})` };
const bad: Translator = {
  engine: "bad",
  translate: async () => {
    throw new Error("down");
  },
};
const rows = [
  { entity: "log_entries", id: 9, text: "a" },
  { entity: "journal", id: 8, text: "b" },
];

describe("translate batch", () => {
  test("translates rows through translation_put, reserving part of the cap", async () => {
    const db = new Fake({ translation_untranslated: rows, usage_try_reserved: true });
    const r = await runTranslateBatch({ db, translators: [ok], dayCap: 100 });
    expect(r).toMatchObject({ translated: 2, errors: [] });
    expect(db.n("translation_put")).toBe(2);
    expect(db.calls.find((c) => c.name === "usage_try_reserved")!.args).toMatchObject({
      p_cap: 100,
      p_reserve: 30,
    });
    expect(db.calls.find((c) => c.name === "translation_put")!.args).toMatchObject({
      p_entity: "log_entries",
      p_id: 9,
      p_text: "PT(a)",
    });
  });
  test("budget exhausted stops without translating", async () => {
    const db = new Fake({ translation_untranslated: rows, usage_try_reserved: false });
    const r = await runTranslateBatch({ db, translators: [ok], dayCap: 10 });
    expect(r).toMatchObject({ translated: 0, skipped: "daily budget" });
    expect(db.n("translation_put")).toBe(0);
  });
  test("engine failure refunds the slot, stops, never throws", async () => {
    const db = new Fake({ translation_untranslated: rows, usage_try_reserved: true });
    const r = await runTranslateBatch({ db, translators: [bad], dayCap: 10 });
    expect(r.translated).toBe(0);
    expect(r.errors[0]).toMatch(/down/);
    expect(db.n("usage_refund")).toBe(1);
    expect(db.n("usage_try_reserved")).toBe(1);
  });
  test("rpc failure is reported, not thrown; no translators is a no-op", async () => {
    const db = new Fake({
      translation_untranslated: () => {
        throw new Error("db down");
      },
    });
    expect((await runTranslateBatch({ db, translators: [ok], dayCap: 10 })).errors).toHaveLength(1);
    const none = new Fake({});
    expect(await runTranslateBatch({ db: none, translators: [], dayCap: 10 })).toMatchObject({
      skipped: "no translator",
    });
    expect(none.calls).toHaveLength(0);
  });
});
