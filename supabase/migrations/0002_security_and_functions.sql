-- Migration 0002: lockdown (RLS closed), append-only guards, archive role, tick_commit RPC.
-- Browser never talks to Supabase: anon/authenticated get no table or function access and no policies exist for them.
-- Only the Worker (service_role key) reads/writes. The archive job uses the read-only role archive_reader.
SET search_path = public, extensions;

-- 1. RLS on every table, no policies for anon/authenticated ---------------------------------------------
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;

-- 2. Strip default grants (Supabase grants ALL to anon/authenticated on new public objects) -------------
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES    FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM %I', r);
    END IF;
  END LOOP;
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- 3. Append-only log (rule 6): no DELETE/TRUNCATE ever; UPDATE may only flip `hidden` ---------------------
CREATE OR REPLACE FUNCTION trg_log_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF (to_jsonb(NEW) - 'hidden' - 'tsv') IS DISTINCT FROM (to_jsonb(OLD) - 'hidden' - 'tsv') THEN
      RAISE EXCEPTION '% is append-only: only "hidden" may change', TG_TABLE_NAME USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION '% is append-only: % not allowed (hide flags, never deletes)', TG_TABLE_NAME, TG_OP USING ERRCODE = 'integrity_constraint_violation';
END $$;

CREATE TRIGGER log_entries_append_only BEFORE UPDATE OR DELETE ON log_entries
  FOR EACH ROW EXECUTE FUNCTION trg_log_append_only();
CREATE TRIGGER log_entries_no_truncate BEFORE TRUNCATE ON log_entries
  FOR EACH STATEMENT EXECUTE FUNCTION trg_log_append_only();
CREATE TRIGGER events_append_only BEFORE UPDATE OR DELETE ON events
  FOR EACH ROW EXECUTE FUNCTION trg_log_append_only();
CREATE TRIGGER events_no_truncate BEFORE TRUNCATE ON events
  FOR EACH STATEMENT EXECUTE FUNCTION trg_log_append_only();

-- Admin hide/unhide: flips the flag only.
CREATE OR REPLACE FUNCTION admin_set_hidden(p_id bigint, p_hidden boolean) RETURNS boolean
LANGUAGE sql SET search_path = public AS $$
  WITH u AS (UPDATE log_entries SET hidden = p_hidden WHERE id = p_id RETURNING 1) SELECT EXISTS (SELECT 1 FROM u);
$$;

-- 3b. Death is permanent (hard rule 7): resident.status can never leave 'dead'; the row can never be deleted.
CREATE OR REPLACE FUNCTION trg_resident_permanent_death() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'dead' AND NEW.status IS DISTINCT FROM 'dead' THEN
      RAISE EXCEPTION 'resident is dead: death is permanent (status cannot change from dead)' USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'resident row cannot be deleted or truncated' USING ERRCODE = 'integrity_constraint_violation';
END $$;
CREATE TRIGGER resident_permanent_death BEFORE UPDATE OR DELETE ON resident
  FOR EACH ROW EXECUTE FUNCTION trg_resident_permanent_death();
CREATE TRIGGER resident_no_truncate BEFORE TRUNCATE ON resident
  FOR EACH STATEMENT EXECUTE FUNCTION trg_resident_permanent_death();

-- 4. Archive support: llm_traces stubs (doc 05). Only llm_traces content is ever pruned; log rows stay. -----
ALTER TABLE llm_traces ADD COLUMN content_hash text;

CREATE OR REPLACE FUNCTION archive_confirm_traces(p_ids bigint[], p_ref text, p_min_age interval DEFAULT interval '14 days')
RETURNS int LANGUAGE plpgsql SET search_path = public, extensions AS $$
DECLARE n int;
BEGIN
  IF p_ref IS NULL OR p_ref = '' THEN RAISE EXCEPTION 'archived_ref required'; END IF;
  UPDATE llm_traces
     SET content_hash = md5(coalesce(system_prompt,'') || coalesce(messages::text,'') || coalesce(response,'')),
         system_prompt = NULL, messages = NULL, response = NULL, archived_ref = p_ref
   WHERE id = ANY(p_ids) AND archived_ref IS NULL AND ts < now() - p_min_age;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

-- Size governor input (80% early archive, 90% degrade).
CREATE OR REPLACE FUNCTION db_size_bytes() RETURNS bigint LANGUAGE sql STABLE AS $$ SELECT pg_database_size(current_database()); $$;

-- 5. Portuguese search over cached translations (never read by the Resident) -----------------------------
CREATE OR REPLACE FUNCTION search_translations(q text, p_lang text DEFAULT 'pt', lim int DEFAULT 30, before_id bigint DEFAULT NULL)
RETURNS TABLE (entity_id bigint, ts timestamptz, kind text, category text, text text, translated text, rank real)
LANGUAGE sql STABLE SET search_path = public, extensions AS $$
  SELECT l.id, l.ts, l.kind, l.category, l.text, t.text,
         ts_rank(t.tsv, websearch_to_tsquery('portuguese', q))
  FROM translations t JOIN log_entries l ON t.entity = 'log_entries' AND l.id = t.entity_id
  WHERE t.lang = p_lang AND NOT l.hidden
    AND t.tsv @@ websearch_to_tsquery('portuguese', q)
    AND (before_id IS NULL OR l.id < before_id)
  ORDER BY 7 DESC, l.id DESC LIMIT lim;
$$;

-- 6. tick_commit(jsonb): one RPC = one transaction = one tick's writes (free tier: 50 subrequests/invocation).
-- Payload (all keys optional except tick):
--  tick:{started_at,ended_at,mode,provider,ok,error}
--  log_entries:[{ref,kind,category,text,data,lang,ts,caused_by_ref|caused_by}]   (cause must precede effect in the array)
--  events:[{t_start,t_end,kind,actor,data,v,log_ref}]   decisions:[{action,intent,expectation,outcome,...}]
--  memories, organism_samples, appraisals:[{stimulus_ref,dims,source}], llm_traces, tool_calls
--  usage:[{day,provider,calls,tokens_in,tokens_out,errors}]  tool_usage:[{day,tool,calls}]
--  resident:{x,z,heading,station,status,phase,organism,physiology,vitals,skills,active_plan,last_tick_at}
--  kv:{key:value,...}
-- Returns {tick_id, log_ids:{ref:id}}. Any error rolls the whole tick back.
CREATE OR REPLACE FUNCTION tick_commit(payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SET search_path = public, extensions AS $$
DECLARE
  v_tick bigint; v_map jsonb := '{}'::jsonb; e jsonb; v_id bigint; v_cause bigint; v_res jsonb;
BEGIN
  IF payload IS NULL OR jsonb_typeof(payload) <> 'object' OR NOT payload ? 'tick' THEN
    RAISE EXCEPTION 'tick_commit: payload.tick required';
  END IF;

  INSERT INTO ticks (started_at, ended_at, mode, provider, ok, error)
  SELECT started_at, ended_at, mode, provider, ok, error
  FROM jsonb_to_record(payload->'tick') AS x(started_at timestamptz, ended_at timestamptz, mode text, provider text, ok boolean, error text)
  RETURNING id INTO v_tick;

  FOR e IN SELECT * FROM jsonb_array_elements(coalesce(payload->'log_entries','[]')) LOOP
    v_cause := NULL;
    IF e ? 'caused_by_ref' THEN
      IF NOT v_map ? (e->>'caused_by_ref') THEN RAISE EXCEPTION 'tick_commit: unknown caused_by_ref %', e->>'caused_by_ref'; END IF;
      v_cause := (v_map->>(e->>'caused_by_ref'))::bigint;
    ELSIF e ? 'caused_by' AND jsonb_typeof(e->'caused_by') = 'number' THEN
      v_cause := (e->>'caused_by')::bigint;
    END IF;
    INSERT INTO log_entries (ts, tick_id, kind, category, text, data, caused_by, lang)
    VALUES (coalesce((e->>'ts')::timestamptz, now()), v_tick, e->>'kind', e->>'category',
            coalesce(e->>'text',''), coalesce(e->'data','{}'::jsonb), v_cause, coalesce(e->>'lang','en'))
    RETURNING id INTO v_id;
    IF e ? 'ref' THEN v_map := v_map || jsonb_build_object(e->>'ref', v_id); END IF;
  END LOOP;

  INSERT INTO events (t_start, t_end, kind, actor, data, log_id, v)
  SELECT x.t_start, x.t_end, x.kind, x.actor, coalesce(x.data,'{}'::jsonb),
         CASE WHEN x.log_ref IS NOT NULL THEN (v_map->>x.log_ref)::bigint ELSE x.log_id END, coalesce(x.v,1)
  FROM jsonb_to_recordset(coalesce(payload->'events','[]')) AS x(t_start timestamptz, t_end timestamptz, kind text, actor text, data jsonb, log_ref text, log_id bigint, v int);

  INSERT INTO decisions (tick_id, action, intent, expectation, outcome, outcome_review, prediction_error)
  SELECT v_tick, x.action, x.intent, x.expectation, x.outcome, x.outcome_review, x.prediction_error
  FROM jsonb_to_recordset(coalesce(payload->'decisions','[]')) AS x(action jsonb, intent text, expectation text, outcome jsonb, outcome_review jsonb, prediction_error real);

  INSERT INTO memories (kind, text, source_url, importance, topic, appraisal, body_snapshot)
  SELECT x.kind, x.text, x.source_url, coalesce(x.importance,0.5), x.topic, x.appraisal, x.body_snapshot
  FROM jsonb_to_recordset(coalesce(payload->'memories','[]')) AS x(kind text, text text, source_url text, importance real, topic text, appraisal jsonb, body_snapshot jsonb);

  INSERT INTO organism_samples (tick_id, organism, physiology, emotion_top3)
  SELECT v_tick, x.organism, x.physiology, x.emotion_top3
  FROM jsonb_to_recordset(coalesce(payload->'organism_samples','[]')) AS x(organism jsonb, physiology jsonb, emotion_top3 jsonb);

  INSERT INTO appraisals (tick_id, stimulus_log_id, dims, source)
  SELECT v_tick, CASE WHEN x.stimulus_ref IS NOT NULL THEN (v_map->>x.stimulus_ref)::bigint ELSE x.stimulus_log_id END, x.dims, x.source
  FROM jsonb_to_recordset(coalesce(payload->'appraisals','[]')) AS x(stimulus_ref text, stimulus_log_id bigint, dims jsonb, source text);

  INSERT INTO llm_traces (tick_id, role, provider, model, system_prompt, messages, response, tokens_in, tokens_out, latency_ms, finish_reason, ok)
  SELECT v_tick, x.role, x.provider, x.model, x.system_prompt, x.messages, x.response, x.tokens_in, x.tokens_out, x.latency_ms, x.finish_reason, x.ok
  FROM jsonb_to_recordset(coalesce(payload->'llm_traces','[]')) AS x(role text, provider text, model text, system_prompt text, messages jsonb, response text, tokens_in int, tokens_out int, latency_ms int, finish_reason text, ok boolean);

  INSERT INTO tool_calls (tick_id, tool, input, status, bytes, ok, error)
  SELECT v_tick, x.tool, x.input, x.status, x.bytes, x.ok, x.error
  FROM jsonb_to_recordset(coalesce(payload->'tool_calls','[]')) AS x(tool text, input jsonb, status int, bytes int, ok boolean, error text);

  INSERT INTO usage_daily (day, provider, calls, tokens_in, tokens_out, errors)
  SELECT x.day, x.provider, coalesce(x.calls,0), coalesce(x.tokens_in,0), coalesce(x.tokens_out,0), coalesce(x.errors,0)
  FROM jsonb_to_recordset(coalesce(payload->'usage','[]')) AS x(day date, provider text, calls int, tokens_in bigint, tokens_out bigint, errors int)
  ON CONFLICT (day, provider) DO UPDATE SET calls = usage_daily.calls + EXCLUDED.calls,
    tokens_in = usage_daily.tokens_in + EXCLUDED.tokens_in, tokens_out = usage_daily.tokens_out + EXCLUDED.tokens_out,
    errors = usage_daily.errors + EXCLUDED.errors;

  INSERT INTO tool_usage_daily (day, tool, calls)
  SELECT x.day, x.tool, coalesce(x.calls,0)
  FROM jsonb_to_recordset(coalesce(payload->'tool_usage','[]')) AS x(day date, tool text, calls int)
  ON CONFLICT (day, tool) DO UPDATE SET calls = tool_usage_daily.calls + EXCLUDED.calls;

  IF payload ? 'kv' THEN
    INSERT INTO kv (key, value) SELECT j.k, j.v FROM jsonb_each(payload->'kv') AS j(k, v)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
  END IF;

  v_res := payload->'resident';
  IF v_res IS NOT NULL AND jsonb_typeof(v_res) = 'object' THEN
    -- Death is permanent: a dead resident cannot be revived through a tick (the trigger also enforces this).
    IF v_res ? 'status' AND v_res->>'status' IS DISTINCT FROM 'dead'
       AND EXISTS (SELECT 1 FROM resident WHERE id = 1 AND status = 'dead') THEN
      RAISE EXCEPTION 'tick_commit: resident is dead, death is permanent' USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    UPDATE resident SET
      x = coalesce((v_res->>'x')::real, x), z = coalesce((v_res->>'z')::real, z),
      heading = coalesce((v_res->>'heading')::real, heading),
      station = CASE WHEN v_res ? 'station' THEN v_res->>'station' ELSE station END,
      status = coalesce(v_res->>'status', status), phase = coalesce(v_res->>'phase', phase),
      organism = coalesce(v_res->'organism', organism), physiology = coalesce(v_res->'physiology', physiology),
      vitals = coalesce(v_res->'vitals', vitals), skills = coalesce(v_res->'skills', skills),
      active_plan = CASE WHEN v_res ? 'active_plan' THEN nullif(v_res->'active_plan','null'::jsonb) ELSE active_plan END,
      last_tick_at = coalesce((v_res->>'last_tick_at')::timestamptz, now()),
      seq = seq + 1
    WHERE id = 1;
  END IF;

  RETURN jsonb_build_object('tick_id', v_tick, 'log_ids', v_map);
END $$;

-- 7. Grants: service_role (Worker) only for functions ----------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION tick_commit(jsonb), admin_set_hidden(bigint, boolean),
      archive_confirm_traces(bigint[], text, interval), db_size_bytes(), search_translations(text, text, int, bigint),
      search_log(text, text[], text, timestamptz, timestamptz, int, bigint) TO service_role;
  END IF;
END $$;

-- 8. Read-only role for the archive GitHub Action (login + password set out-of-band, never in the repo).
--    ALTER ROLE archive_reader LOGIN PASSWORD '<from GitHub secret>';   -- run once in the Supabase SQL editor
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'archive_reader') THEN
    CREATE ROLE archive_reader NOLOGIN NOINHERIT;
  END IF;
END $$;
ALTER ROLE archive_reader SET default_transaction_read_only = on;
ALTER ROLE archive_reader SET statement_timeout = '60s';
GRANT USAGE ON SCHEMA public TO archive_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO archive_reader;
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('CREATE POLICY archive_reader_select ON public.%I FOR SELECT TO archive_reader USING (true)', t.tablename);
  END LOOP;
END $$;
