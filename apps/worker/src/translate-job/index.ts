// Background translation batch (decision 50b). Runs after the tick in the scheduled handler: translates the newest
// untranslated Resident-text rows EN -> PT into the cache, within the shared daily server-translation budget.
// Presentation only; never read by the Resident. Failures never throw; they are reported to the caller.
import type { Rpc } from "../api";
import { MAX_TRANSLATE_CHARS, translateWithFallback, type Translator } from "../api/translate";

/** Small on purpose: scheduled invocations have 50 subrequests (tick included). Each item costs about 3 to 8. */
export const BATCH_ITEMS_PER_RUN = 3;
/** Share of the daily cap kept for on-demand viewer requests (the batch cannot spend it). */
export const BATCH_RESERVE_FRACTION = 0.3;

export interface BatchResult {
  translated: number;
  skipped: string | null;
  errors: string[];
}

interface Row {
  entity: string;
  id: number;
  text: string;
}

const isRow = (r: unknown): r is Row => {
  const o = r as Row;
  return (
    !!o &&
    typeof o.entity === "string" &&
    Number.isFinite(Number(o.id)) &&
    typeof o.text === "string" &&
    o.text.length > 0
  );
};

export async function runTranslateBatch(opts: {
  db: Rpc;
  translators: Translator[];
  dayCap: number;
  items?: number;
  scrub?: (m: string) => string;
}): Promise<BatchResult> {
  const scrub = opts.scrub ?? ((m: string) => m);
  const out: BatchResult = { translated: 0, skipped: null, errors: [] };
  if (opts.translators.length === 0) return { ...out, skipped: "no translator" };
  const reserve = Math.floor(opts.dayCap * BATCH_RESERVE_FRACTION);
  try {
    const rows = (await opts.db.rpc("translation_untranslated", {
      p_lim: opts.items ?? BATCH_ITEMS_PER_RUN,
      p_lang: "pt",
      p_max_chars: MAX_TRANSLATE_CHARS,
    })) as unknown;
    if (!Array.isArray(rows) || rows.length === 0) return { ...out, skipped: "nothing to do" };
    for (const r of rows.filter(isRow)) {
      const allowed = await opts.db.rpc("usage_try_reserved", {
        p_tool: "translate_server",
        p_cap: opts.dayCap,
        p_reserve: reserve,
      });
      if (allowed !== true) {
        out.skipped = "daily budget";
        break;
      }
      try {
        const t = await translateWithFallback(opts.translators, r.text);
        await opts.db.rpc("translation_put", {
          p_entity: r.entity,
          p_id: Number(r.id),
          p_lang: "pt",
          p_text: t.text,
          p_engine: t.engine,
        });
        out.translated++;
      } catch (e) {
        out.errors.push(scrub(e instanceof Error ? e.message : String(e)).slice(0, 200));
        await opts.db.rpc("usage_refund", { p_tool: "translate_server" }).catch(() => undefined);
        // an engine outage will repeat for the next rows: stop for this run
        break;
      }
    }
  } catch (e) {
    out.errors.push(scrub(e instanceof Error ? e.message : String(e)).slice(0, 200));
  }
  return out;
}
