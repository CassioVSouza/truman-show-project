import { readConfig, redact, type Env } from "./env";
import { SupabaseDb } from "./db/supabase";
import { runTick } from "./tick";
import { handleApi } from "./api";
import { parseOrigins } from "./api/http";
import { MyMemoryTranslator, WorkersAiTranslator, type Translator } from "./api/translate";

const DEFAULT_TRANSLATE_DAY = 150;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const scrub = (m: string) => redact(m, env);
    const url = new URL(request.url);
    if (url.pathname === "/") return new Response("ok");
    let db: SupabaseDb;
    try {
      db = new SupabaseDb(readConfig(env));
    } catch (e) {
      console.error("config error:", scrub(e instanceof Error ? e.message : String(e)));
      return new Response(JSON.stringify({ error: "internal error" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }
    const translators: Translator[] = [];
    if (env.AI) translators.push(new WorkersAiTranslator(env.AI));
    translators.push(new MyMemoryTranslator());
    const cap = Number(env.TRANSLATE_SERVER_DAY);
    return handleApi(
      request,
      {
        db,
        env: { allowedOrigins: parseOrigins(env.ALLOWED_ORIGINS) },
        adminToken: env.ADMIN_TOKEN,
        translators,
        translateDayCap: Number.isFinite(cap) && cap > 0 ? Math.floor(cap) : DEFAULT_TRANSLATE_DAY,
        // admin "tick now": a fresh client so the subrequest budget of this request is not shared with the API call
        runTick: () => runTick(new SupabaseDb(readConfig(env)), () => new Date(), scrub),
      },
      (m) => console.error(scrub(m)),
    );
  },
  async scheduled(_event: unknown, env: Env): Promise<void> {
    try {
      const db = new SupabaseDb(readConfig(env));
      await runTick(
        db,
        () => new Date(),
        (m) => redact(m, env),
      );
    } catch (e) {
      // never log secret values
      console.error("tick failed:", redact(e instanceof Error ? e.message : String(e), env));
    }
  },
};
