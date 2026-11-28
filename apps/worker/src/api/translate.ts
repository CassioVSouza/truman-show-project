// Server-side translation fallback (EN -> PT-BR). Chrome on-device translation runs in the browser first; this runs only
// when the browser cannot, and the result is cached forever per entity + id + lang (SQL: translation_put, first write wins).
// Never read by the Resident. Free engines only: Workers AI (binding, optional) then MyMemory (keyless, small quota).

export interface Translator {
  engine: string;
  translate(text: string): Promise<string>;
}

/** Minimal shape of the Workers AI binding. */
export interface AiBinding {
  run(model: string, input: Record<string, unknown>): Promise<unknown>;
}

// UNVERIFIED on the Free plan (doc 05): kept in one place so it is trivial to change.
export const WORKERS_AI_TRANSLATE_MODEL = "@cf/meta/m2m100-1.2b";
export const MAX_TRANSLATE_CHARS = 1800;
/** Hard ceiling for one source text: longer text is split into pieces of at most PIECE_CHARS, never failed silently. */
export const MAX_SOURCE_CHARS = 7200;
const PIECE_CHARS = 1500;

export class WorkersAiTranslator implements Translator {
  engine = "workers-ai";
  constructor(
    private ai: AiBinding,
    private model = WORKERS_AI_TRANSLATE_MODEL,
  ) {}
  async translate(text: string): Promise<string> {
    const r = (await this.ai.run(this.model, {
      text,
      source_lang: "english",
      target_lang: "portuguese",
    })) as { translated_text?: unknown };
    if (typeof r?.translated_text !== "string" || !r.translated_text.trim()) {
      throw new Error("workers-ai: empty translation");
    }
    return r.translated_text;
  }
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** Splits on sentence ends so each piece stays under the engine's per-request limit. */
export function chunkText(text: string, max = 450): string[] {
  const out: string[] = [];
  let cur = "";
  for (const part of text.split(/(?<=[.!?])\s+/)) {
    if (cur && cur.length + part.length + 1 > max) {
      out.push(cur);
      cur = "";
    }
    let p = part;
    while (p.length > max) {
      out.push(p.slice(0, max));
      p = p.slice(max);
    }
    cur = cur ? `${cur} ${p}` : p;
  }
  if (cur) out.push(cur);
  return out;
}

export class MyMemoryTranslator implements Translator {
  engine = "mymemory";
  constructor(
    private fetchFn: FetchLike = (u, i) => fetch(u, i),
    private maxChunks = 6,
  ) {}
  async translate(text: string): Promise<string> {
    const chunks = chunkText(text);
    if (chunks.length > this.maxChunks) throw new Error("mymemory: text too long");
    const out: string[] = [];
    for (const c of chunks) {
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(c)}&langpair=en%7Cpt-BR`;
      const res = await this.fetchFn(url, { signal: AbortSignal.timeout(6000) });
      if (!res.ok) throw new Error(`mymemory: http ${res.status}`);
      const j = (await res.json()) as {
        responseStatus?: unknown;
        responseData?: { translatedText?: unknown };
      };
      const t = j.responseData?.translatedText;
      // quota and error notices come back as 200 with a warning text and a non-200 responseStatus
      if (
        Number(j.responseStatus) !== 200 ||
        typeof t !== "string" ||
        /MYMEMORY WARNING/i.test(t)
      ) {
        throw new Error("mymemory: no translation");
      }
      out.push(t);
    }
    return out.join(" ");
  }
}

/** Tries each translator in order; reports which engine produced the text. Text over the per-request limit is split. */
export async function translateWithFallback(
  chain: Translator[],
  text: string,
): Promise<{ text: string; engine: string }> {
  if (text.length > MAX_TRANSLATE_CHARS) {
    const outs: string[] = [];
    let engine = "";
    for (const piece of chunkText(text, PIECE_CHARS)) {
      const r = await translateWithFallback(chain, piece);
      outs.push(r.text);
      engine = r.engine;
    }
    return { text: outs.join(" "), engine };
  }
  let last = "no translator configured";
  for (const t of chain) {
    try {
      return { text: await t.translate(text), engine: t.engine };
    } catch (e) {
      last = `${t.engine}: ${e instanceof Error ? e.message : String(e)}`;
    }
  }
  throw new Error(last);
}
