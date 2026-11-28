import { describe, expect, it, vi } from "vitest";
import type { ViewerApiClient } from "../api/client";
import { TranslationQueue } from "../i18n/translationQueue";
import { bindTranslation, entityFallback, type TextSink } from "./translatable";

const sink = (text: string): TextSink => ({ textContent: text, className: "", isConnected: true });
const now = (_t: TextSink, start: () => void): void => start();
const flush = () => new Promise((r) => setTimeout(r, 0));

describe("bindTranslation", () => {
  it("leaves EN untouched", () => {
    const el = sink("hello");
    const tag = sink("EN");
    bindTranslation(el, tag, "hello", "en", "ola");
    expect(el.textContent).toBe("hello");
    expect(tag.textContent).toBe("EN");
  });

  it("uses the API cached translation first, without any request", () => {
    const queue = new TranslationQueue({ translate: vi.fn() });
    const spy = vi.spyOn(queue, "request");
    const el = sink("hello");
    const tag = sink("");
    bindTranslation(el, tag, "hello", "pt-BR", "ola", undefined, { queue });
    expect(el.textContent).toBe("ola");
    expect(tag.textContent).toBe("PT-BR");
    expect(spy).not.toHaveBeenCalled();
  });

  it("falls back to the queue, then shows the translation", async () => {
    const server = vi.fn(async () => "traduzido");
    const queue = new TranslationQueue();
    const el = sink("bind-ok");
    const tag = sink("");
    bindTranslation(el, tag, "bind-ok", "pt-BR", null, server, { queue, whenVisible: now });
    expect(tag.textContent).toBe("…");
    await flush();
    expect(el.textContent).toBe("traduzido");
    expect(tag.textContent).toBe("PT-BR");
  });

  it("shows English with a visible [EN] tag on failure and retries with backoff", async () => {
    const answers: Array<string | null> = [null, "agora sim"];
    const server = vi.fn(async () => answers.shift() ?? null);
    const queue = new TranslationQueue();
    const scheduled: Array<{ fn: () => void; ms: number }> = [];
    const el = sink("bind-fail");
    const tag = sink("");
    bindTranslation(el, tag, "bind-fail", "pt-BR", null, server, {
      queue,
      whenVisible: now,
      schedule: (fn, ms) => scheduled.push({ fn, ms }),
    });
    await flush();
    expect(el.textContent).toBe("bind-fail");
    expect(tag.textContent).toBe("[EN]");
    expect(tag.className).toContain("tag-fallback");
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0]!.ms).toBe(20_000);
    scheduled[0]!.fn();
    await flush();
    expect(el.textContent).toBe("agora sim");
    expect(tag.textContent).toBe("PT-BR");
  });

  it("stops retrying once the element left the page", async () => {
    const server = vi.fn(async () => null);
    const queue = new TranslationQueue();
    const scheduled: Array<() => void> = [];
    const el = sink("bind-gone");
    bindTranslation(el, null, "bind-gone", "pt-BR", null, server, {
      queue,
      whenVisible: now,
      schedule: (fn) => scheduled.push(fn),
    });
    await flush();
    el.isConnected = false;
    scheduled[0]!();
    await flush();
    expect(server).toHaveBeenCalledTimes(1);
  });

  it("gives up after the retry limit", async () => {
    const queue = new TranslationQueue();
    const server = vi.fn(async () => null);
    const scheduled: Array<() => void> = [];
    const el = sink("bind-limit");
    bindTranslation(el, null, "bind-limit", "pt-BR", null, server, {
      queue,
      whenVisible: now,
      maxRetries: 2,
      schedule: (fn) => scheduled.push(fn),
    });
    await flush();
    scheduled.shift()!();
    await flush();
    scheduled.shift()!();
    await flush();
    expect(scheduled).toHaveLength(0);
    expect(server).toHaveBeenCalledTimes(3);
  });
});

describe("entityFallback", () => {
  it("calls translateEntity with the entity and id, or nothing without an id", async () => {
    const translateEntity = vi.fn(async () => "x");
    const api = { translateEntity } as unknown as ViewerApiClient;
    await entityFallback(api, "memories", 9)!();
    expect(translateEntity).toHaveBeenCalledWith("memories", 9);
    expect(entityFallback(api, "dreams", 0)).toBeUndefined();
  });
});
