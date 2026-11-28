import { describe, expect, it, vi } from "vitest";
import type { TranslatedText } from "./index";
import { retryDelayMs, TranslationQueue } from "./translationQueue";

const ok = (text: string): TranslatedText => ({ text, lang: "pt", isFallback: false });

describe("TranslationQueue", () => {
  it("returns EN text untouched without calling anything", async () => {
    const translate = vi.fn();
    const q = new TranslationQueue({ translate });
    expect(await q.request({ original: "hi", lang: "en" })).toEqual({
      text: "hi",
      lang: "en",
      isFallback: false,
    });
    expect(translate).not.toHaveBeenCalled();
  });

  it("dedupes identical in-flight texts into one translation", async () => {
    let release!: (v: TranslatedText) => void;
    const translate = vi.fn(
      () =>
        new Promise<TranslatedText>((resolve) => {
          release = resolve;
        }),
    );
    const q = new TranslationQueue({ translate });
    const a = q.request({ original: "same text", lang: "pt-BR" });
    const b = q.request({ original: "same text", lang: "pt-BR" });
    release(ok("mesmo texto"));
    expect(await a).toEqual(await b);
    expect(translate).toHaveBeenCalledTimes(1);
  });

  it("limits concurrency", async () => {
    let active = 0;
    let peak = 0;
    const translate = vi.fn(async (o: string) => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      return ok(o);
    });
    const q = new TranslationQueue({ concurrency: 2, translate });
    await Promise.all(
      ["a", "b", "c", "d", "e"].map((o) => q.request({ original: o, lang: "pt-BR" })),
    );
    expect(peak).toBe(2);
    expect(translate).toHaveBeenCalledTimes(5);
  });

  it("skips inactive jobs without touching the translator", async () => {
    const translate = vi.fn(async (o: string) => ok(o));
    const q = new TranslationQueue({ translate });
    const res = await q.request({ original: "gone", lang: "pt-BR", isActive: () => false });
    expect(res.isFallback).toBe(true);
    expect(translate).not.toHaveBeenCalled();
  });

  it("keeps server calls under the per-minute window and waits for it to clear", async () => {
    let clock = 0;
    const waits: number[] = [];
    const server = vi.fn(async () => "pt");
    // Real translateDynamic with no Chrome Translator in node: server fallback is used.
    const q = new TranslationQueue({
      concurrency: 1,
      serverPerMinute: 2,
      now: () => clock,
      wait: async (ms) => {
        waits.push(ms);
        clock += ms;
      },
    });
    for (const o of ["one", "two", "three"]) {
      const res = await q.request({ original: `rate-${o}`, lang: "pt-BR", serverFallback: server });
      expect(res.isFallback).toBe(false);
    }
    expect(server).toHaveBeenCalledTimes(3);
    expect(waits).toHaveLength(1);
    expect(waits[0]).toBeGreaterThanOrEqual(60_000);
  });

  it("does not cache failures so a later request can succeed", async () => {
    const results = ["fail", "good"];
    const server = vi.fn(async () => (results.shift() === "good" ? "bom" : null));
    const q = new TranslationQueue();
    const first = await q.request({
      original: "retry-me",
      lang: "pt-BR",
      serverFallback: server,
    });
    expect(first.isFallback).toBe(true);
    const second = await q.request({
      original: "retry-me",
      lang: "pt-BR",
      serverFallback: server,
    });
    expect(second).toEqual({ text: "bom", lang: "pt", isFallback: false });
  });

  it("backs off exponentially up to a cap", () => {
    expect(retryDelayMs(0)).toBe(20_000);
    expect(retryDelayMs(1)).toBe(40_000);
    expect(retryDelayMs(2)).toBe(80_000);
    expect(retryDelayMs(20)).toBe(300_000);
  });
});
