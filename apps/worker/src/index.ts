import { readConfig, redact, type Env } from "./env";
import { SupabaseDb } from "./db/supabase";
import { runTick } from "./tick";

export default {
  async fetch(): Promise<Response> {
    return new Response("ok");
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
