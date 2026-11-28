import type { ViewerApiClient } from "../api/client";
import { t, type UiLang } from "../i18n";
import {
  retryDelayMs,
  sharedTranslationQueue,
  type TranslationQueue,
} from "../i18n/translationQueue";
import { el } from "./dom";

/** Minimal element surface so the binding is testable without a DOM. */
export interface TextSink {
  textContent: string | null;
  className?: string;
  isConnected?: boolean;
}

export type TranslatableEntity = "log_entries" | "journal" | "dreams" | "beliefs" | "memories";

export interface BindOptions {
  queue?: TranslationQueue;
  /** Defers the first attempt until the element is on screen; default uses IntersectionObserver when present. */
  whenVisible?: (target: TextSink, start: () => void) => void;
  schedule?: (fn: () => void, ms: number) => unknown;
  maxRetries?: number;
}

function defaultWhenVisible(target: TextSink, start: () => void): void {
  const IO = (globalThis as { IntersectionObserver?: typeof IntersectionObserver })
    .IntersectionObserver;
  if (!IO || typeof (target as { nodeType?: unknown }).nodeType !== "number") {
    // Cards are built before they are attached; start after the current synchronous render.
    void Promise.resolve().then(start);
    return;
  }
  const obs = new IO(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        obs.disconnect();
        start();
      }
    },
    { rootMargin: "200px" },
  );
  obs.observe(target as unknown as Element);
}

function stillHere(node: TextSink): boolean {
  return node.isConnected !== false;
}

/**
 * Shows the translation of `original` in `textEl` (PT-BR UI only). Order: API `cachedPt`, then the
 * shared queue (Chrome on-device translator, then server fallback). On failure the English stays,
 * the tag reads [EN] and a retry runs with backoff while the element is still on the page.
 */
export function bindTranslation(
  textEl: TextSink,
  tagEl: TextSink | null,
  original: string,
  lang: UiLang,
  cachedPt: string | null,
  serverFallback?: () => Promise<string | null>,
  opts: BindOptions = {},
): void {
  if (lang === "en" || !original.trim()) return;
  const setTag = (label: string, cls: string): void => {
    if (!tagEl) return;
    tagEl.textContent = label;
    tagEl.className = cls;
  };
  if (cachedPt && cachedPt.trim()) {
    textEl.textContent = cachedPt;
    setTag(t(lang, "translatedTag"), "tag tag-lang");
    return;
  }
  const queue = opts.queue ?? sharedTranslationQueue;
  const schedule = opts.schedule ?? ((fn, ms) => setTimeout(fn, ms));
  const maxRetries = opts.maxRetries ?? 5;
  setTag("…", "tag");

  const attempt = (n: number): void => {
    void queue
      .request({ original, lang, serverFallback, isActive: () => stillHere(textEl) })
      .then((res) => {
        if (!stillHere(textEl)) return;
        if (!res.isFallback) {
          textEl.textContent = res.text;
          setTag(t(lang, "translatedTag"), "tag tag-lang");
          return;
        }
        setTag(t(lang, "enFallbackTag"), "tag tag-fallback");
        if (n < maxRetries) schedule(() => stillHere(textEl) && attempt(n + 1), retryDelayMs(n));
      });
  };
  (opts.whenVisible ?? defaultWhenVisible)(textEl, () => attempt(0));
}

export function entityFallback(
  api: ViewerApiClient,
  entity: TranslatableEntity,
  id: number,
): (() => Promise<string | null>) | undefined {
  return id > 0 ? () => api.translateEntity(entity, id) : undefined;
}

export interface TranslatedParagraph {
  p: HTMLElement;
  tag: HTMLElement;
}

/** A Resident-text paragraph plus its language tag, wired to translate in PT-BR. Text nodes only. */
export function translatedParagraph(
  className: string,
  original: string,
  lang: UiLang,
  cachedPt: string | null,
  serverFallback?: () => Promise<string | null>,
): TranslatedParagraph {
  const p = el("p", { class: className }, original);
  const tag = el("span", { class: "tag" }, lang === "en" ? "EN" : "…");
  bindTranslation(p, tag, original, lang, cachedPt, serverFallback);
  return { p, tag };
}

/** Inline Resident text with its own language tag, for places that have no separate tag slot. */
export function translatedInline(
  original: string,
  lang: UiLang,
  cachedPt: string | null,
  serverFallback?: () => Promise<string | null>,
  prefix = "",
): HTMLElement {
  const textNode = el("span", null, original);
  const tag = el("span", { class: "tag tag-lang-inline" });
  bindTranslation(textNode, tag, original, lang, cachedPt, serverFallback);
  return el("span", null, prefix, textNode, lang === "en" ? null : " ", lang === "en" ? null : tag);
}

/** Label/value row whose value is Resident text translated in PT-BR (on-device, or server when `fallback` is given). */
export function kvRowT(
  label: string,
  value: string,
  lang: UiLang,
  fallback?: () => Promise<string | null>,
  cachedPt: string | null = null,
): HTMLElement | null {
  if (!value.trim()) return null;
  return el(
    "div",
    { class: "entry-kv" },
    el("span", { class: "entry-kv-label" }, label),
    el("span", { class: "entry-kv-val" }, translatedInline(value, lang, cachedPt, fallback)),
  );
}
