-- Plain-SQL assertions. Run against a DB with migrations 0001-0004 applied (see supabase/tests/run.sh).
-- Any failed assertion raises and psql -v ON_ERROR_STOP=1 exits non-zero.
\set ON_ERROR_STOP on
CREATE OR REPLACE FUNCTION pg_temp.assert(ok boolean, msg text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF NOT coalesce(ok,false) THEN RAISE EXCEPTION 'ASSERT FAILED: %', msg; END IF; END $$;
GRANT EXECUTE ON FUNCTION pg_temp.assert(boolean, text) TO PUBLIC;  -- default privileges now revoke it; anon checks below call it

-- 1. RLS on every public table, and no policy for anon/authenticated
SELECT pg_temp.assert(NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND NOT rowsecurity), 'RLS enabled on all tables');
SELECT pg_temp.assert(NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND (roles && ARRAY['anon','authenticated','public']::name[])), 'no anon/authenticated/public policies');
SELECT pg_temp.assert(NOT EXISTS (SELECT 1 FROM information_schema.role_table_grants WHERE table_schema='public' AND grantee IN ('anon','authenticated','PUBLIC')), 'no table grants for anon/authenticated');

-- 1b. EVERY function of ours in public: no execute for PUBLIC/anon/authenticated, execute for service_role
DO $$
DECLARE f record; r text;
BEGIN
  FOR f IN SELECT p.oid, p.oid::regprocedure AS sig FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
    AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e') LOOP
    PERFORM pg_temp.assert(NOT has_function_privilege('anon', f.oid, 'EXECUTE'), 'anon can execute ' || f.sig);
    PERFORM pg_temp.assert(NOT has_function_privilege('authenticated', f.oid, 'EXECUTE'), 'authenticated can execute ' || f.sig);
    PERFORM pg_temp.assert(NOT EXISTS (SELECT 1 FROM pg_proc q, aclexplode(coalesce(q.proacl, acldefault('f', q.proowner))) a
      WHERE q.oid = f.oid AND a.grantee = 0 AND a.privilege_type='EXECUTE'), 'PUBLIC can execute ' || f.sig);
    PERFORM pg_temp.assert(has_function_privilege('service_role', f.oid, 'EXECUTE'), 'service_role cannot execute ' || f.sig);
  END LOOP;
  PERFORM pg_temp.assert((SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace) >= 6, 'functions exist');
END $$;
-- 1c. a function created later by the migration roles is closed by default
CREATE FUNCTION public.zz_probe() RETURNS int LANGUAGE sql AS 'SELECT 1';
SELECT pg_temp.assert(NOT has_function_privilege('anon','public.zz_probe()','EXECUTE') AND NOT has_function_privilege('authenticated','public.zz_probe()','EXECUTE'), 'new functions closed by default');
DROP FUNCTION public.zz_probe();

-- 2. tick_commit: one call, causal links, events linked, resident updated
INSERT INTO resident (id, born_at, x, z, heading, temperament, organism, physiology) VALUES (1, now(), 0, 0, 0, '{}', '{}', '{}');
CREATE TEMP TABLE out AS SELECT tick_commit($j$
{"tick":{"started_at":"2026-01-01T00:00:00Z","mode":"normal","ok":true},
 "log_entries":[
  {"ref":"a","kind":"perception","category":"life","text":"a warm light on the wall"},
  {"ref":"b","kind":"thought","category":"life","text":"the light moves slowly","caused_by_ref":"a"},
  {"ref":"c","kind":"llm_call","category":"lab","text":"call","caused_by_ref":"b"}],
 "events":[{"t_start":"2026-01-01T00:00:00Z","t_end":"2026-01-01T00:00:05Z","kind":"thought","actor":"resident","log_ref":"b"}],
 "decisions":[{"action":{"k":"look"},"intent":"see","expectation":"light"}],
 "usage":[{"day":"2026-01-01","provider":"x","calls":1,"tokens_in":10,"tokens_out":5}],
 "resident":{"x":3.5,"station":"window","active_plan":null},
 "kv":{"phase":"unaware"}}
$j$::jsonb) AS r;
SELECT pg_temp.assert((SELECT count(*) FROM log_entries) = 3, 'three log entries');
SELECT pg_temp.assert((SELECT l.caused_by FROM log_entries l WHERE kind='thought') = (SELECT id FROM log_entries WHERE kind='perception'), 'thought caused_by perception');
SELECT pg_temp.assert((SELECT l.caused_by FROM log_entries l WHERE kind='llm_call') = (SELECT id FROM log_entries WHERE kind='thought'), 'chain a->b->c');
SELECT pg_temp.assert((SELECT log_id FROM events) = (SELECT id FROM log_entries WHERE kind='thought'), 'event linked to log');
SELECT pg_temp.assert((SELECT count(*) FROM log_entries WHERE tick_id = (SELECT (r->>'tick_id')::bigint FROM out)) = 3, 'entries carry tick_id');
SELECT pg_temp.assert((SELECT x = 3.5 AND station='window' AND seq = 1 FROM resident), 'resident patched');
-- usage accumulates across ticks
SELECT tick_commit('{"tick":{"started_at":"2026-01-01T00:10:00Z","mode":"normal"},"usage":[{"day":"2026-01-01","provider":"x","calls":2,"tokens_in":1,"tokens_out":1}]}');
SELECT pg_temp.assert((SELECT calls = 3 FROM usage_daily), 'usage_daily accumulates');

-- 3. Atomicity: bad ref rolls back the whole tick
DO $$
DECLARE before_n int := (SELECT count(*) FROM ticks); failed boolean := false;
BEGIN
  BEGIN
    PERFORM tick_commit('{"tick":{"started_at":"2026-01-01T00:20:00Z","mode":"normal"},"log_entries":[{"kind":"x","category":"life","text":"ok"},{"kind":"y","category":"life","caused_by_ref":"nope"}]}');
  EXCEPTION WHEN OTHERS THEN failed := true; END;
  PERFORM pg_temp.assert(failed, 'bad ref raises');
  PERFORM pg_temp.assert((SELECT count(*) FROM ticks) = before_n, 'tick rolled back');
  PERFORM pg_temp.assert(NOT EXISTS (SELECT 1 FROM log_entries WHERE kind='x'), 'log rolled back');
END $$;

-- 4. Append-only: hide flips flag, never deletes; text immutable; delete/truncate blocked
SELECT pg_temp.assert(admin_set_hidden((SELECT min(id) FROM log_entries), true), 'hide ok');
SELECT pg_temp.assert((SELECT hidden FROM log_entries WHERE id = (SELECT min(id) FROM log_entries)), 'row hidden');
SELECT pg_temp.assert((SELECT count(*) FROM log_entries) = 3, 'hide never deletes');
SELECT pg_temp.assert(NOT EXISTS (SELECT 1 FROM api_search('warm light')), 'hidden excluded from search');
SELECT admin_set_hidden((SELECT min(id) FROM log_entries), false);
SELECT pg_temp.assert(EXISTS (SELECT 1 FROM api_search('warm light')), 'unhidden found by search');
DO $$
DECLARE blocked int := 0;
BEGIN
  BEGIN DELETE FROM log_entries; EXCEPTION WHEN integrity_constraint_violation THEN blocked := blocked + 1; END;
  BEGIN UPDATE log_entries SET text = 'edited'; EXCEPTION WHEN integrity_constraint_violation THEN blocked := blocked + 1; END;
  BEGIN TRUNCATE log_entries CASCADE; EXCEPTION WHEN integrity_constraint_violation THEN blocked := blocked + 1; END;
  BEGIN DELETE FROM events; EXCEPTION WHEN integrity_constraint_violation THEN blocked := blocked + 1; END;
  PERFORM pg_temp.assert(blocked = 4, 'delete/update/truncate blocked, got ' || blocked);
END $$;

-- 5. Translation search (portuguese)
INSERT INTO translations (entity, entity_id, lang, text, engine)
SELECT 'log_entries', id, 'pt', 'uma luz quente na parede', 'test' FROM log_entries WHERE kind='perception';
SELECT pg_temp.assert(EXISTS (SELECT 1 FROM api_search('paredes', 'pt')), 'portuguese stemming finds parede');

-- 6. Archive: stub keeps hash + archived_ref, recent rows untouched
INSERT INTO llm_traces (ts, role, provider, model, system_prompt, response, ok) VALUES
  (now() - interval '20 days','resident','p','m','sys','resp',true), (now(),'resident','p','m','sys','resp',true);
SELECT pg_temp.assert(archive_confirm_traces(ARRAY(SELECT id FROM llm_traces), 'https://example/asset.jsonl.gz') = 1, 'only old trace pruned');
SELECT pg_temp.assert((SELECT response IS NULL AND content_hash IS NOT NULL AND archived_ref IS NOT NULL FROM llm_traces ORDER BY id LIMIT 1), 'stub row');

-- 7. archive_reader: can read, cannot write
SET ROLE archive_reader;
SELECT pg_temp.assert((SELECT count(*) FROM log_entries) = 3, 'archive_reader reads all rows');
DO $$
BEGIN
  BEGIN INSERT INTO kv VALUES ('k','1'); PERFORM pg_temp.assert(false, 'archive_reader wrote'); EXCEPTION WHEN insufficient_privilege OR read_only_sql_transaction THEN NULL; END;
END $$;
RESET ROLE;

-- 8. anon/authenticated: no access at all (only if the Supabase roles exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
    SET LOCAL ROLE anon;
    BEGIN PERFORM count(*) FROM log_entries; PERFORM pg_temp.assert(false, 'anon read log_entries');
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    BEGIN PERFORM tick_commit('{"tick":{}}'); PERFORM pg_temp.assert(false, 'anon ran tick_commit');
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    RESET ROLE;
  END IF;
END $$;
-- 9. Death is permanent (rule 7)
SELECT tick_commit('{"tick":{"started_at":"2026-01-02T00:00:00Z","mode":"t","ok":true},"resident":{"status":"dead"}}');
SELECT pg_temp.assert((SELECT status = 'dead' FROM resident), 'death recorded via tick_commit');
SELECT tick_commit('{"tick":{"started_at":"2026-01-02T00:00:00Z","mode":"t","ok":true},"resident":{"x":9}}');  -- non-status updates still fine
SELECT pg_temp.assert((SELECT x = 9 AND status = 'dead' FROM resident), 'dead resident still updatable, stays dead');
DO $$
DECLARE blocked int := 0;
BEGIN
  BEGIN PERFORM tick_commit('{"tick":{"started_at":"2026-01-02T00:00:00Z","mode":"t","ok":true},"resident":{"status":"running"}}'); EXCEPTION WHEN integrity_constraint_violation THEN blocked := blocked + 1; END;
  BEGIN UPDATE resident SET status = 'running'; EXCEPTION WHEN integrity_constraint_violation THEN blocked := blocked + 1; END;
  BEGIN UPDATE resident SET status = NULL; EXCEPTION WHEN integrity_constraint_violation OR not_null_violation THEN blocked := blocked + 1; END;
  BEGIN DELETE FROM resident; EXCEPTION WHEN integrity_constraint_violation THEN blocked := blocked + 1; END;
  BEGIN TRUNCATE resident CASCADE; EXCEPTION WHEN integrity_constraint_violation THEN blocked := blocked + 1; END;
  PERFORM pg_temp.assert(blocked = 5, 'revival/delete blocked, got ' || blocked);
  PERFORM pg_temp.assert((SELECT status = 'dead' FROM resident), 'still dead');
END $$;

-- 11. Skipped and failed ticks (exact Worker payload shapes): tick row + one append-only log row each
DO $$
DECLARE n0 int; r jsonb;
BEGIN
  SELECT count(*) INTO n0 FROM log_entries WHERE kind = 'tick';
  r := tick_commit('{"tick":{"started_at":"2026-01-04T00:00:00Z","ended_at":"2026-01-04T00:00:01Z","mode":"skipped","provider":null,"ok":true,"error":"paused"},"log_entries":[{"kind":"tick","category":"lab","text":"tick skipped: paused","data":{"mode":"skipped"}}]}'::jsonb);
  PERFORM pg_temp.assert((SELECT mode = 'skipped' AND ok AND error = 'paused' FROM ticks WHERE id = (r->>'tick_id')::bigint), 'skipped tick row');
  PERFORM pg_temp.assert((SELECT count(*) FROM log_entries WHERE tick_id = (r->>'tick_id')::bigint AND kind = 'tick' AND category = 'lab') = 1, 'skipped tick log row');
  r := tick_commit('{"tick":{"started_at":"2026-01-04T00:10:00Z","ended_at":"2026-01-04T00:10:01Z","mode":"failed","provider":null,"ok":false,"error":"boom [redacted]"},"log_entries":[{"kind":"tick","category":"lab","text":"tick failed: boom [redacted]","data":{"mode":"failed"}}]}'::jsonb);
  PERFORM pg_temp.assert((SELECT mode = 'failed' AND NOT ok AND error = 'boom [redacted]' AND provider IS NULL FROM ticks WHERE id = (r->>'tick_id')::bigint), 'failed tick row');
  PERFORM pg_temp.assert((SELECT count(*) FROM log_entries WHERE tick_id = (r->>'tick_id')::bigint AND kind = 'tick') = 1, 'failed tick log row');
  PERFORM pg_temp.assert((SELECT count(*) FROM log_entries WHERE kind = 'tick') = n0 + 2, 'two new tick log rows');
  -- a failed tick without log_entries (minimal payload) still commits the ticks row alone
  r := tick_commit('{"tick":{"started_at":"2026-01-04T00:20:00Z","mode":"failed","ok":false,"error":"x"}}'::jsonb);
  PERFORM pg_temp.assert((SELECT NOT ok FROM ticks WHERE id = (r->>'tick_id')::bigint), 'minimal failed tick');
END $$;

-- 10. service_role (the Worker): privileges on EVERY table/sequence, and the Worker's real calls work AS service_role
DO $$
DECLARE t record; s record;
BEGIN
  FOR t IN SELECT c.oid, c.relname FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relkind IN ('r','p') LOOP
    PERFORM pg_temp.assert(has_table_privilege('service_role', t.oid, 'SELECT') AND has_table_privilege('service_role', t.oid, 'INSERT')
      AND has_table_privilege('service_role', t.oid, 'UPDATE'), 'service_role lacks S/I/U on ' || t.relname || ' (new table needs a GRANT)');
    PERFORM pg_temp.assert(NOT has_table_privilege('service_role', t.oid, 'DELETE') AND NOT has_table_privilege('service_role', t.oid, 'TRUNCATE'),
      'service_role has DELETE/TRUNCATE on ' || t.relname);
    PERFORM pg_temp.assert(NOT has_table_privilege('anon', t.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
      AND NOT has_table_privilege('authenticated', t.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'), 'anon/authenticated privilege on ' || t.relname);
    PERFORM pg_temp.assert(NOT has_table_privilege('archive_reader', t.oid, 'INSERT,UPDATE,DELETE'), 'archive_reader can write ' || t.relname);
  END LOOP;
  FOR s IN SELECT c.oid, c.relname FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relkind='S' LOOP
    PERFORM pg_temp.assert(has_sequence_privilege('service_role', s.oid, 'USAGE'), 'service_role lacks USAGE on ' || s.relname);
    PERFORM pg_temp.assert(NOT has_sequence_privilege('anon', s.oid, 'USAGE,SELECT,UPDATE') AND NOT has_sequence_privilege('authenticated', s.oid, 'USAGE,SELECT,UPDATE'),
      'anon/authenticated sequence privilege on ' || s.relname);
  END LOOP;
END $$;
SET ROLE service_role;
-- The Worker's exact calls: loadState (resident + kv) and tick_commit via RPC
SELECT pg_temp.assert((SELECT count(*) FROM resident WHERE id = 1) = 1, 'service_role reads resident');
SELECT pg_temp.assert((SELECT count(*) FROM kv) >= 0, 'service_role reads kv');
SELECT tick_commit('{"tick":{"started_at":"2026-01-03T00:00:00Z","mode":"t","ok":true},"log_entries":[{"kind":"x","category":"life","text":"as service_role"}],"kv":{"k_sr":1}}');
SELECT pg_temp.assert((SELECT count(*) FROM log_entries WHERE text = 'as service_role') = 1, 'tick_commit as service_role wrote log');
DO $$
BEGIN
  BEGIN DELETE FROM kv; PERFORM pg_temp.assert(false, 'service_role deleted'); EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
-- anon/authenticated: cannot select/insert on any table, cannot use sequences
DO $$
DECLARE t record; r text; s record; ok boolean;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
    EXECUTE format('SET LOCAL ROLE %I', r);
    FOR t IN SELECT relname FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind IN ('r','p') LOOP
      ok := false;
      BEGIN EXECUTE format('SELECT 1 FROM public.%I LIMIT 1', t.relname); EXCEPTION WHEN insufficient_privilege THEN ok := true; END;
      PERFORM pg_temp.assert(ok, r || ' could select ' || t.relname);
      ok := false;
      BEGIN EXECUTE format('INSERT INTO public.%I DEFAULT VALUES', t.relname); EXCEPTION WHEN insufficient_privilege THEN ok := true; WHEN OTHERS THEN ok := false; END;
      PERFORM pg_temp.assert(ok, r || ' could insert into ' || t.relname);
    END LOOP;
    FOR s IN SELECT relname FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='S' LOOP
      ok := false;
      BEGIN EXECUTE format('SELECT nextval(%L)', 'public.' || s.relname); EXCEPTION WHEN insufficient_privilege THEN ok := true; END;
      PERFORM pg_temp.assert(ok, r || ' could use sequence ' || s.relname);
    END LOOP;
    RESET ROLE;
  END LOOP;
END $$;


-- 12. Read API (0005): search keyset pages, context chain, hidden handling, lists, translation cache, audited admin
SELECT tick_commit($j$
{"tick":{"started_at":"2026-02-01T00:00:00Z","mode":"normal","ok":true},
 "log_entries":[
  {"ref":"p","kind":"perception","category":"life","text":"zebra grazing near the river"},
  {"ref":"t","kind":"thought","category":"life","text":"the zebra looks calm","caused_by_ref":"p"},
  {"ref":"a","kind":"action","category":"life","text":"walk toward the zebra","caused_by_ref":"t"},
  {"ref":"r","kind":"outcome_review","category":"life","text":"the zebra ran away","caused_by_ref":"a"},
  {"ref":"x","kind":"llm_trace","category":"lab","text":"zebra prompt trace","caused_by_ref":"t"}],
 "organism_samples":[{"organism":{"arousal":0.4},"physiology":{"heart_rate":70},"emotion_top3":[]}],
 "llm_traces":[{"role":"resident","provider":"p","model":"m","response":"zebra","ok":true}],
 "decisions":[{"action":{"type":"move_to"},"intent":"see closer","expectation":"it stays"}],
 "kv":{}}
$j$::jsonb);
-- search: filters and keyset pagination without skipping or repeating rows
SELECT pg_temp.assert((SELECT count(*) FROM api_search('zebra')) = 5, 'search finds all five zebra entries');
SELECT pg_temp.assert((SELECT count(*) FROM api_search('zebra', 'en', NULL, 'life')) = 4, 'category filter');
SELECT pg_temp.assert((SELECT count(*) FROM api_search('zebra', 'en', ARRAY['thought'])) = 1, 'kind filter');
SELECT pg_temp.assert((SELECT count(*) FROM api_search('zebra', 'en', NULL, NULL, now() + interval '1 day')) = 0, 'date filter');
SELECT pg_temp.assert((SELECT count(*) FROM api_search('zebr', 'en')) >= 0, 'fuzzy partial match does not error');
DO $$
DECLARE seen bigint[]; page record; last_id bigint; last_rank double precision; n int; s text;
BEGIN
  FOREACH s IN ARRAY ARRAY['time', 'relevance'] LOOP
    seen := '{}'; last_id := NULL; last_rank := NULL;
    LOOP
      n := 0;
      FOR page IN SELECT * FROM api_search('zebra', 'en', NULL, NULL, NULL, NULL, 2, last_id, last_rank, s) LOOP
        PERFORM pg_temp.assert(NOT page.id = ANY(seen), 'no repeated row in ' || s || ' paging');
        seen := seen || page.id; last_id := page.id; last_rank := page.rank; n := n + 1;
      END LOOP;
      EXIT WHEN n < 2;
    END LOOP;
    PERFORM pg_temp.assert(cardinality(seen) = 5, s || ' paging visits all 5 rows, got ' || cardinality(seen));
  END LOOP;
END $$;
-- context: causes root-first, consequences with depth, body state, trace refs; hidden cuts the chain
DO $$
DECLARE tid bigint := (SELECT id FROM log_entries WHERE kind = 'thought' AND text = 'the zebra looks calm'); aid bigint; c jsonb;
BEGIN
  c := api_context(tid);
  PERFORM pg_temp.assert(c->'entry'->>'id' = tid::text, 'context entry');
  PERFORM pg_temp.assert(jsonb_array_length(c->'causes') = 1 AND c->'causes'->0->>'kind' = 'perception', 'context cause');
  PERFORM pg_temp.assert(jsonb_array_length(c->'consequences') = 3, 'context consequences (action, trace, review)');
  PERFORM pg_temp.assert((c->'consequences'->0->>'depth')::int = 1 AND (c->'consequences'->2->>'depth')::int = 2, 'consequence depth ordering');
  PERFORM pg_temp.assert(c->'body'->'physiology'->>'heart_rate' = '70', 'body state at the tick');
  PERFORM pg_temp.assert(jsonb_array_length(c->'trace_refs'->'llm_traces') = 1 AND jsonb_array_length(c->'trace_refs'->'decisions') = 1, 'trace refs');
  PERFORM pg_temp.assert(api_context(-1) IS NULL, 'unknown entry has no context');
  aid := (SELECT id FROM log_entries WHERE kind = 'action' AND text = 'walk toward the zebra');
  PERFORM pg_temp.assert(admin_hide(aid, true), 'admin_hide ok');
  PERFORM pg_temp.assert(api_context(aid) IS NULL, 'hidden entry has no context');
  c := api_context(tid);
  PERFORM pg_temp.assert(jsonb_array_length(c->'consequences') = 1, 'hidden descendant cuts its subtree');
  PERFORM pg_temp.assert(NOT EXISTS (SELECT 1 FROM api_search('walk toward')), 'hidden not searchable');
  PERFORM pg_temp.assert(EXISTS (SELECT 1 FROM log_entries WHERE kind = 'system' AND data->>'admin' = 'hide'), 'hide is audit-logged');
  PERFORM pg_temp.assert(EXISTS (SELECT 1 FROM log_entries WHERE id = aid AND hidden), 'hidden row still stored');
  PERFORM pg_temp.assert(jsonb_array_length(admin_export(0, 1000)) = (SELECT count(*) FROM log_entries), 'export includes hidden rows');
  PERFORM admin_hide(aid, false);
END $$;
-- lists, log pages, status, governor
SELECT pg_temp.assert(api_list('decisions') @> '[{"intent":"see closer"}]', 'decisions list');
SELECT pg_temp.assert(api_list('traces')->0 ? 'response_preview' AND NOT (api_list('traces')->0 ? 'system_prompt'), 'traces list has preview only');
SELECT pg_temp.assert(jsonb_array_length(api_list('organism')) = 1, 'organism list');
SELECT pg_temp.assert(jsonb_array_length(api_log('perception')) >= 1, 'log page by kind');
DO $$
BEGIN
  BEGIN PERFORM api_list('users'); PERFORM pg_temp.assert(false, 'unknown list accepted'); EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
END $$;
SELECT pg_temp.assert(api_status() ? 'status' AND api_status() ? 'day', 'status shape');
SELECT pg_temp.assert(api_governor() ? 'db_size_bytes' AND api_governor() ? 'usage', 'governor shape');
-- translation cache: whitelist, first write wins, hidden entries not translatable, daily cap
DO $$
DECLARE pid bigint := (SELECT id FROM log_entries WHERE kind = 'perception' AND text = 'zebra grazing near the river');
BEGIN
  PERFORM pg_temp.assert(translation_source('log_entries', pid) = 'zebra grazing near the river', 'translation source');
  PERFORM pg_temp.assert(translation_source('kv', 1) IS NULL, 'entity whitelist');
  PERFORM pg_temp.assert(translation_lookup('log_entries', pid, 'pt')->>'translated' IS NULL AND translation_lookup('log_entries', pid, 'pt')->>'source' IS NOT NULL, 'lookup before cache');
  PERFORM pg_temp.assert(translation_put('log_entries', pid, 'pt', 'zebra pastando perto do rio', 'test'), 'translation stored');
  PERFORM pg_temp.assert(NOT translation_put('log_entries', pid, 'pt', 'outra coisa', 'test'), 'cache forever, first write wins');
  PERFORM pg_temp.assert((SELECT text FROM translations WHERE entity = 'log_entries' AND entity_id = pid AND lang = 'pt') = 'zebra pastando perto do rio', 'translation unchanged');
  PERFORM pg_temp.assert(translation_lookup('log_entries', pid, 'pt')->>'engine' = 'test', 'lookup after cache');
  PERFORM pg_temp.assert(NOT translation_put('log_entries', pid, 'fr', 'x', 'test'), 'only supported languages');
  PERFORM pg_temp.assert(NOT translation_put('log_entries', -5, 'pt', 'x', 'test'), 'missing entity not stored');
  PERFORM pg_temp.assert(EXISTS (SELECT 1 FROM api_search('pastando', 'pt')), 'pt search finds the cached translation');
  PERFORM pg_temp.assert((SELECT text_en FROM api_search('pastando', 'pt') LIMIT 1) = 'zebra grazing near the river', 'pt result keeps the english original');
  PERFORM pg_temp.assert(NOT EXISTS (SELECT 1 FROM api_search('pastando', 'en')), 'en search does not read translations');
  PERFORM pg_temp.assert(usage_try('t_cap', 2) AND usage_try('t_cap', 2) AND NOT usage_try('t_cap', 2), 'daily cap enforced');
  PERFORM admin_hide(pid, true);
  PERFORM pg_temp.assert(NOT EXISTS (SELECT 1 FROM api_search('pastando', 'pt')), 'hidden entry not found via pt either');
  PERFORM pg_temp.assert(translation_source('log_entries', pid) IS NULL, 'hidden entry not translatable');
  PERFORM admin_hide(pid, false);
END $$;
-- audited flags: only the two gate keys
SELECT admin_set_flag('pause', 'paused', true);
SELECT pg_temp.assert((SELECT value = 'true'::jsonb FROM kv WHERE key = 'paused') AND api_status()->>'status' = 'dead', 'pause flag set; a dead resident reports dead (death wins)');
SELECT admin_set_flag('resume', 'paused', false);
DO $$
BEGIN
  BEGIN PERFORM admin_set_flag('x', 'phase', true); PERFORM pg_temp.assert(false, 'arbitrary kv key accepted'); EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
END $$;
-- everything must also work AS service_role, and be closed to anon
SET ROLE service_role;
SELECT pg_temp.assert((SELECT count(*) FROM api_search('zebra')) >= 4, 'service_role search');
SELECT pg_temp.assert(api_context((SELECT id FROM log_entries WHERE kind = 'thought' AND text = 'the zebra looks calm')) IS NOT NULL, 'service_role context');
SELECT pg_temp.assert(admin_hide((SELECT id FROM log_entries WHERE kind = 'perception' AND text = 'zebra grazing near the river'), false), 'service_role admin_hide');
SELECT pg_temp.assert(api_list('journal') IS NOT NULL AND api_status() IS NOT NULL AND api_governor() IS NOT NULL, 'service_role lists');
RESET ROLE;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
    SET LOCAL ROLE anon;
    BEGIN PERFORM api_search('zebra'); PERFORM pg_temp.assert(false, 'anon ran api_search'); EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    BEGIN PERFORM admin_hide(1, true); PERFORM pg_temp.assert(false, 'anon ran admin_hide'); EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    RESET ROLE;
  END IF;
END $$;

SELECT 'ALL TESTS PASSED' AS result;
