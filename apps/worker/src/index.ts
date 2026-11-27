import { readConfig, redact, type Env } from "./env";
import { SupabaseDb } from "./db/supabase";
import type { Db } from "./db/types";
import { governorConfigFromEnv, type Lease } from "./governor";
import { providersFromEnv, type FetchLike, type LlmProvider } from "./llm";
import { LogWriter } from "./log";
import { MemoryRows, runMindTick, type MindTickResult } from "./tick";
import { startResident } from "./tick/start";
import { createWebTools } from "./tools";
import { handleApi } from "./api";
import { parseOrigins } from "./api/http";
import { MyMemoryTranslator, WorkersAiTranslator, type Translator } from "./api/translate";
import { createSnapshotPublisher, type SnapshotWriter } from "./snapshot";
import { makePagesSnapshotWriter } from "./snapshot/pages";

const DEFAULT_TRANSLATE_DAY = 150;

export interface LiveTickOptions {
  db?: Db;
  now?: () => Date;
  scheduledAtMs?: number;
  fetchFn?: FetchLike;
  lease?: Lease;
  providers?: LlmProvider[];
  writeSnapshot?: SnapshotWriter;
}

/**
 * Runs one full mind tick wired to real providers (Gemini -> Groq -> Workers AI fallback), the single log writer,
 * SupabaseDb, governor config from env, guarded web tools, and the atomic kv tick lease.
 * Fails cleanly into an idle/continuing tick when LLM keys are absent.
 */
export async function runLiveTick(env: Env, opts: LiveTickOptions = {}): Promise<MindTickResult> {
  const scrub = (m: string) => redact(m, env);
  const db = opts.db ?? new SupabaseDb(readConfig(env), opts.fetchFn);
  const lease = opts.lease ?? (db instanceof SupabaseDb ? db.createLease() : undefined);
  const providers = opts.providers ?? providersFromEnv(env);
  const governor = governorConfigFromEnv(env);
  const tools = createWebTools({
    tavilyApiKey: env.TAVILY_API_KEY,
    fetchFn: opts.fetchFn,
    scrub,
  });
  const writeSnapshot = opts.writeSnapshot ?? makePagesSnapshotWriter(env, opts.fetchFn);
  return runMindTick({
    db,
    log: new LogWriter(scrub),
    rows: new MemoryRows(),
    providers,
    tools,
    governor,
    lease,
    now: opts.now ?? (() => new Date()),
    scheduledAtMs: opts.scheduledAtMs,
    scrub,
    publishSnapshot:
      writeSnapshot && db instanceof SupabaseDb
        ? createSnapshotPublisher(
            (from, until) => db.readSnapshotEvents(from, until),
            writeSnapshot,
          )
        : undefined,
    onSnapshotError: (tickId, error) =>
      console.error({
        event: "snapshot_publish_failed",
        tick_id: tickId,
        error: scrub(error instanceof Error ? error.message : String(error)).slice(0, 250),
      }),
  });
}

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
        // admin "tick now": fresh SupabaseDb inside runLiveTick so subrequest budget is not shared with the API call
        runTick: () => runLiveTick(env),
        startResident: () =>
          startResident(db, db.createLease(), undefined, governorConfigFromEnv(env).timeScale),
      },
      (m) => console.error(scrub(m)),
    );
  },
  async scheduled(event: { scheduledTime?: number }, env: Env): Promise<void> {
    try {
      await runLiveTick(env, { scheduledAtMs: event.scheduledTime });
    } catch (e) {
      // never log secret values
      console.error("tick failed:", redact(e instanceof Error ? e.message : String(e), env));
    }
  },
};
