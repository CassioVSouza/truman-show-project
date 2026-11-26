import { EN, type I18nKey } from "./en";
import { PT_BR } from "./pt-BR";

export type UiLang = "en" | "pt-BR";
export type ApiLang = "en" | "pt";

const DICTS: Record<UiLang, Record<I18nKey, string>> = {
  en: EN,
  "pt-BR": PT_BR,
};

export function t(lang: UiLang, key: I18nKey): string {
  return DICTS[lang][key] ?? EN[key];
}

export function toApiLang(lang: UiLang): ApiLang {
  return lang === "pt-BR" ? "pt" : "en";
}

export function stationLabel(lang: UiLang, station: string | null | undefined): string {
  if (!station) return "—";
  const key = `station_${station}` as I18nKey;
  if (key in EN) return t(lang, key);
  return station.replace(/_/g, " ");
}

/**
 * Dynamic text translation helper (doc 02):
 * 1. If UI lang is EN, returns original text.
 * 2. Tries Chrome built-in Translator API if available (`Translator.create`).
 * 3. Falls back to server-side `/api/translate` callback if provided.
 * 4. Falls back to EN original with `isFallback: true` so UI can show `[EN]` tag.
 */
interface ChromeTranslator {
  translate(input: string): Promise<string>;
}
interface ChromeTranslatorApi {
  create(opts: { sourceLanguage: string; targetLanguage: string }): Promise<ChromeTranslator>;
}

let cachedChromeTranslator: Promise<ChromeTranslator | null> | null = null;

async function getChromeTranslator(): Promise<ChromeTranslator | null> {
  if (typeof globalThis === "undefined") return null;
  const api = (globalThis as unknown as { Translator?: ChromeTranslatorApi }).Translator;
  if (!api || typeof api.create !== "function") return null;
  if (!cachedChromeTranslator) {
    cachedChromeTranslator = api
      .create({ sourceLanguage: "en", targetLanguage: "pt" })
      .catch(() => null);
  }
  return cachedChromeTranslator;
}

export interface TranslatedText {
  text: string;
  lang: "en" | "pt";
  isFallback: boolean;
}

const memoryCache = new Map<string, TranslatedText>();

export async function translateDynamic(
  original: string,
  uiLang: UiLang,
  serverFallback?: () => Promise<string | null>,
): Promise<TranslatedText> {
  if (uiLang === "en" || !original.trim()) {
    return { text: original, lang: "en", isFallback: false };
  }
  const cacheKey = `pt:${original}`;
  const hit = memoryCache.get(cacheKey);
  if (hit) return hit;

  const chrome = await getChromeTranslator();
  if (chrome) {
    try {
      const translated = await chrome.translate(original);
      if (translated && translated.trim()) {
        const res: TranslatedText = { text: translated, lang: "pt", isFallback: false };
        memoryCache.set(cacheKey, res);
        return res;
      }
    } catch {
      // fall through to server
    }
  }

  if (serverFallback) {
    try {
      const srv = await serverFallback();
      if (srv && srv.trim()) {
        const res: TranslatedText = { text: srv, lang: "pt", isFallback: false };
        memoryCache.set(cacheKey, res);
        return res;
      }
    } catch {
      // fall through to EN fallback
    }
  }

  return { text: original, lang: "en", isFallback: true };
}

export { EN, PT_BR };
export type { I18nKey };
