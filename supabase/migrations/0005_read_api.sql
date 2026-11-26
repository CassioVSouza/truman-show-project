-- Migration 0005: read API (search, context, lists), translation cache helpers, audited admin actions.
-- Everything here is reachable ONLY by service_role (the Worker). No policies, no anon/authenticated access.
-- Nothing here deletes or edits log data: admin actions flip `hidden` / kv flags and append an audit entry.
SET search_path = public, extensions;

-- 0. Superseded by api_search (the old ones paged by id while ordering by rank, which skips rows).
DROP FUNCTION IF EXISTS search_log(text, text[], text, timestamptz, timestamptz, int, bigint);
DROP FUNCTION IF EXISTS search_translations(text, text, int, bigint);

-- 1. Indexes for the context view and lists (tick joins, keyset pages).
CREATE INDEX IF NOT EXISTS log_tick_idx        ON log_entries (tick_id);
CREATE INDEX IF NOT EXISTS traces_tick_idx     ON llm_traces (tick_id);
CREATE INDEX IF NOT EXISTS tool_calls_tick_idx ON tool_calls (tick_id);
CREATE INDEX IF NOT EXISTS organism_tick_idx   ON organism_samples (tick_id);
CREATE INDEX IF NOT EXISTS decisions_tick_idx  ON decisions (tick_id);
CREATE INDEX IF NOT EXISTS log_kind_id_idx     ON log_entries (kind, id DESC);

-- 2. Public JSON shape of one log entry (matches contracts LogEntry).
CREATE OR REPLACE FUNCTION log_json(l log_entries) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT jsonb_build_object('id', l.id, 'ts', l.ts, 'tick_id', l.tick_id, 'kind', l.kind, 'category', l.category,
    'text', l.text, 'data', l.data, 'caused_by', l.caused_by, 'lang', l.lang, 'hidden', l.hidden);
$$;

-- 3. Global search. EN: english FTS + trigram. Other langs: cached translations (portuguese config).
--    Hidden entries never match. Keyset pages: sort 'time' pages by id; 'relevance' pages by (rank, id).
CREATE OR REPLACE FUNCTION api_search(
  p_q text, p_lang text DEFAULT 'en', p_kinds text[] DEFAULT NULL, p_cat text DEFAULT NULL,
  p_from timestamptz DEFAULT NULL, p_to timestamptz DEFAULT NULL, p_lim int DEFAULT 30,
  p_before_id bigint DEFAULT NULL, p_before_rank double precision DEFAULT NULL, p_sort text DEFAULT 'relevance')
RETURNS TABLE (id bigint, ts timestamptz, tick_id bigint, kind text, category text, text text, text_en text,
               data jsonb, caused_by bigint, lang text, hidden boolean, rank double precision)
LANGUAGE sql STABLE SET search_path = public, extensions AS $$
  WITH cand AS (
    SELECT l.id, l.ts, l.tick_id, l.kind, l.category, l.text AS shown, l.text AS orig, l.data, l.caused_by, l.lang, l.hidden,
           ts_rank(l.tsv, websearch_to_tsquery('english', p_q))::float8 + similarity(l.text, p_q)::float8 * 0.2 AS rnk
    FROM log_entries l
    WHERE p_lang = 'en' AND NOT l.hidden
      AND (l.tsv @@ websearch_to_tsquery('english', p_q) OR l.text % p_q)
    UNION ALL
    SELECT l.id, l.ts, l.tick_id, l.kind, l.category, t.text, l.text, l.data, l.caused_by, l.lang, l.hidden,
           ts_rank(t.tsv, websearch_to_tsquery('portuguese', p_q))::float8 + similarity(t.text, p_q)::float8 * 0.2
    FROM translations t JOIN log_entries l ON t.entity = 'log_entries' AND l.id = t.entity_id
    WHERE p_lang <> 'en' AND t.lang = p_lang AND NOT l.hidden
      AND (t.tsv @@ websearch_to_tsquery('portuguese', p_q) OR t.text % p_q)
  )
  SELECT c.id, c.ts, c.tick_id, c.kind, c.category, c.shown, c.orig, c.data, c.caused_by, c.lang, c.hidden, c.rnk
  FROM cand c
  WHERE (p_kinds IS NULL OR c.kind = ANY(p_kinds)) AND (p_cat IS NULL OR c.category = p_cat)
    AND (p_from IS NULL OR c.ts >= p_from) AND (p_to IS NULL OR c.ts <= p_to)
    AND CASE WHEN p_sort = 'time' THEN (p_before_id IS NULL OR c.id < p_before_id)
             ELSE (p_before_rank IS NULL OR (c.rnk, c.id) < (p_before_rank, coalesce(p_before_id, 9223372036854775807))) END
  ORDER BY (CASE WHEN p_sort = 'time' THEN NULL ELSE c.rnk END) DESC NULLS LAST, c.id DESC
  LIMIT least(greatest(coalesce(p_lim, 30), 1), 100);
$$;

-- 4. Context view: causes (root first), consequences (breadth-first, capped), body state, trace refs.
--    A hidden entry has no context (returns NULL); hidden ancestors/descendants cut the chain there.
CREATE OR REPLACE FUNCTION api_context(p_id bigint, p_max_depth int DEFAULT 25, p_max_nodes int DEFAULT 200)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path = public, extensions AS $$
DECLARE e log_entries; v_depth int; v_nodes int; causes jsonb; cons jsonb; body jsonb; traces jsonb; tools jsonb; decs jsonb;
BEGIN
  SELECT * INTO e FROM log_entries WHERE id = p_id AND NOT hidden;
  IF NOT FOUND THEN RETURN NULL; END IF;
  v_depth := least(greatest(coalesce(p_max_depth, 25), 1), 50);
  v_nodes := least(greatest(coalesce(p_max_nodes, 200), 1), 500);

  WITH RECURSIVE up AS (
    SELECT l.id, l.caused_by, 1 AS d FROM log_entries l WHERE l.id = e.caused_by AND NOT l.hidden
    UNION ALL
    SELECT l.id, l.caused_by, up.d + 1 FROM up JOIN log_entries l ON l.id = up.caused_by WHERE NOT l.hidden AND up.d < v_depth)
  SELECT coalesce(jsonb_agg(log_json(l) ORDER BY up.d DESC), '[]') INTO causes FROM up JOIN log_entries l ON l.id = up.id;

  WITH RECURSIVE down AS (
    SELECT l.id, 1 AS d FROM log_entries l WHERE l.caused_by = e.id AND NOT l.hidden
    UNION ALL
    SELECT l.id, down.d + 1 FROM down JOIN log_entries l ON l.caused_by = down.id WHERE NOT l.hidden AND down.d < v_depth),
  cut AS (SELECT id, d FROM down ORDER BY d, id LIMIT v_nodes)
  SELECT coalesce(jsonb_agg(log_json(l) || jsonb_build_object('depth', cut.d) ORDER BY cut.d, l.id), '[]') INTO cons
  FROM cut JOIN log_entries l ON l.id = cut.id;

  IF e.tick_id IS NOT NULL THEN
    SELECT to_jsonb(s) INTO body FROM (
      SELECT o.id, o.ts, o.tick_id, o.organism, o.physiology, o.emotion_top3 FROM organism_samples o
      WHERE o.tick_id = e.tick_id ORDER BY o.id DESC LIMIT 1) s;
  END IF;
  IF body IS NULL THEN
    SELECT to_jsonb(s) INTO body FROM (
      SELECT o.id, o.ts, o.tick_id, o.organism, o.physiology, o.emotion_top3 FROM organism_samples o
      WHERE o.ts <= e.ts ORDER BY o.ts DESC, o.id DESC LIMIT 1) s;
  END IF;

  SELECT coalesce(jsonb_agg(to_jsonb(s)), '[]') INTO traces FROM (
    SELECT t.id, t.role, t.provider, t.model, t.tokens_in, t.tokens_out, t.latency_ms, t.ok, t.archived_ref
    FROM llm_traces t WHERE e.tick_id IS NOT NULL AND t.tick_id = e.tick_id ORDER BY t.id LIMIT 20) s;
  SELECT coalesce(jsonb_agg(to_jsonb(s)), '[]') INTO tools FROM (
    SELECT t.id, t.tool, t.status, t.ok FROM tool_calls t WHERE e.tick_id IS NOT NULL AND t.tick_id = e.tick_id ORDER BY t.id LIMIT 20) s;
  SELECT coalesce(jsonb_agg(to_jsonb(s)), '[]') INTO decs FROM (
    SELECT d.id, d.intent, d.expectation, d.prediction_error FROM decisions d WHERE e.tick_id IS NOT NULL AND d.tick_id = e.tick_id ORDER BY d.id LIMIT 20) s;

  RETURN jsonb_build_object('entry', log_json(e), 'causes', causes, 'consequences', cons, 'body', body,
    'trace_refs', jsonb_build_object('llm_traces', traces, 'tool_calls', tools, 'decisions', decs));
END $$;

-- 5. Plain log pages (ascending after an id; hidden excluded).
CREATE OR REPLACE FUNCTION api_log(p_kind text DEFAULT NULL, p_cat text DEFAULT NULL, p_after bigint DEFAULT 0, p_lim int DEFAULT 50)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT coalesce(jsonb_agg(log_json(s) ORDER BY s.id), '[]') FROM (
    SELECT * FROM log_entries l
    WHERE NOT l.hidden AND l.id > coalesce(p_after, 0) AND (p_kind IS NULL OR l.kind = p_kind) AND (p_cat IS NULL OR l.category = p_cat)
    ORDER BY l.id LIMIT least(greatest(coalesce(p_lim, 50), 1), 200)) s;
$$;

-- 6. Life and Lab lists (newest first, keyset by id). `translated` is the cached translation or null.
CREATE OR REPLACE FUNCTION api_list(p_what text, p_before bigint DEFAULT NULL, p_lim int DEFAULT 30, p_lang text DEFAULT 'en',
                                    p_from timestamptz DEFAULT NULL, p_to timestamptz DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path = public, extensions AS $$
DECLARE n int := least(greatest(coalesce(p_lim, 30), 1), 100); r jsonb;
BEGIN
  IF p_what = 'journal' THEN
    SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.id DESC), '[]') INTO r FROM (
      SELECT j.id, j.created_at, j.text, j.log_id,
             (SELECT t.text FROM translations t WHERE p_lang <> 'en' AND t.entity = 'journal' AND t.entity_id = j.id AND t.lang = p_lang) AS translated
      FROM journal j LEFT JOIN log_entries l ON l.id = j.log_id
      WHERE (j.log_id IS NULL OR NOT l.hidden) AND (p_before IS NULL OR j.id < p_before) ORDER BY j.id DESC LIMIT n) s;
  ELSIF p_what = 'dreams' THEN
    SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.id DESC), '[]') INTO r FROM (
      SELECT d.id, d.created_at, d.text, d.spawned_question,
             (SELECT t.text FROM translations t WHERE p_lang <> 'en' AND t.entity = 'dreams' AND t.entity_id = d.id AND t.lang = p_lang) AS translated
      FROM dreams d WHERE (p_before IS NULL OR d.id < p_before) ORDER BY d.id DESC LIMIT n) s;
  ELSIF p_what = 'beliefs' THEN
    SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.id DESC), '[]') INTO r FROM (
      SELECT b.id, b.created_at, b.hypothesis, b.confidence, b.evidence,
             (SELECT t.text FROM translations t WHERE p_lang <> 'en' AND t.entity = 'beliefs' AND t.entity_id = b.id AND t.lang = p_lang) AS translated
      FROM beliefs b WHERE (p_before IS NULL OR b.id < p_before) ORDER BY b.id DESC LIMIT n) s;
  ELSIF p_what = 'memories' THEN
    SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.id DESC), '[]') INTO r FROM (
      SELECT m.id, m.created_at, m.kind, m.text, m.source_url, m.importance, m.topic, m.body_snapshot,
             (SELECT t.text FROM translations t WHERE p_lang <> 'en' AND t.entity = 'memories' AND t.entity_id = m.id AND t.lang = p_lang) AS translated
      FROM memories m WHERE (p_before IS NULL OR m.id < p_before) ORDER BY m.id DESC LIMIT n) s;
  ELSIF p_what = 'ideas' THEN
    SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.id DESC), '[]') INTO r FROM (
      SELECT l.id, l.ts, l.kind, l.text, l.data, l.caused_by,
             (SELECT t.text FROM translations t WHERE p_lang <> 'en' AND t.entity = 'log_entries' AND t.entity_id = l.id AND t.lang = p_lang) AS translated
      FROM log_entries l WHERE l.kind IN ('idea', 'question') AND NOT l.hidden AND (p_before IS NULL OR l.id < p_before)
      ORDER BY l.id DESC LIMIT n) s;
  ELSIF p_what = 'organism' THEN
    SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.id DESC), '[]') INTO r FROM (
      SELECT o.id, o.ts, o.tick_id, o.organism, o.physiology, o.emotion_top3 FROM organism_samples o
      WHERE (p_before IS NULL OR o.id < p_before) AND (p_from IS NULL OR o.ts >= p_from) AND (p_to IS NULL OR o.ts <= p_to)
      ORDER BY o.id DESC LIMIT n) s;
  ELSIF p_what = 'appraisals' THEN
    SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.id DESC), '[]') INTO r FROM (
      SELECT a.id, a.ts, a.tick_id, a.stimulus_log_id, a.dims, a.source FROM appraisals a
      LEFT JOIN log_entries l ON l.id = a.stimulus_log_id
      WHERE (a.stimulus_log_id IS NULL OR NOT l.hidden) AND (p_before IS NULL OR a.id < p_before) ORDER BY a.id DESC LIMIT n) s;
  ELSIF p_what = 'decisions' THEN
    SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.id DESC), '[]') INTO r FROM (
      SELECT d.id, d.ts, d.tick_id, d.action, d.intent, d.expectation, d.outcome, d.outcome_review, d.prediction_error
      FROM decisions d WHERE (p_before IS NULL OR d.id < p_before) ORDER BY d.id DESC LIMIT n) s;
  ELSIF p_what = 'traces' THEN   -- metadata + short preview; full text via api_trace
    SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.id DESC), '[]') INTO r FROM (
      SELECT t.id, t.ts, t.tick_id, t.role, t.provider, t.model, t.tokens_in, t.tokens_out, t.latency_ms, t.finish_reason, t.ok,
             t.archived_ref, left(t.response, 300) AS response_preview
      FROM llm_traces t WHERE (p_before IS NULL OR t.id < p_before) ORDER BY t.id DESC LIMIT n) s;
  ELSIF p_what = 'tools' THEN
    SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.id DESC), '[]') INTO r FROM (
      SELECT c.id, c.ts, c.tick_id, c.tool, c.input, c.status, c.bytes, c.ok, c.error
      FROM tool_calls c WHERE (p_before IS NULL OR c.id < p_before) ORDER BY c.id DESC LIMIT n) s;
  ELSIF p_what = 'errors' THEN
    SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.id DESC), '[]') INTO r FROM (
      SELECT l.id, l.ts, l.tick_id, l.kind, l.text, l.data, l.caused_by FROM log_entries l
      WHERE l.kind = 'error' AND NOT l.hidden AND (p_before IS NULL OR l.id < p_before) ORDER BY l.id DESC LIMIT n) s;
  ELSE
    RAISE EXCEPTION 'api_list: unknown list %', p_what USING ERRCODE = 'invalid_parameter_value';
  END IF;
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION api_trace(p_id bigint) RETURNS jsonb LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT to_jsonb(t) - 'content_hash' FROM llm_traces t WHERE t.id = p_id;
$$;

-- 7. Status and governor views.
CREATE OR REPLACE FUNCTION api_status() RETURNS jsonb LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT jsonb_build_object(
    'status', CASE WHEN r.status = 'dead' THEN 'dead'
                   WHEN coalesce((SELECT value #>> '{}' FROM kv WHERE key = 'kill_switch'), 'false') NOT IN ('false', '0', '', 'null', 'off', 'no') THEN 'hibernating'
                   WHEN coalesce((SELECT value #>> '{}' FROM kv WHERE key = 'paused'), 'false') NOT IN ('false', '0', '', 'null', 'off', 'no') THEN 'paused'
                   ELSE coalesce(r.status, 'running') END,
    'phase', r.phase,
    'day', CASE WHEN r.born_at IS NULL THEN NULL ELSE (floor(extract(epoch FROM (now() - r.born_at)) / 86400)::int + 1) END,
    'last_tick_at', r.last_tick_at,
    'mode', (SELECT t.mode FROM ticks t ORDER BY t.id DESC LIMIT 1),
    'world_day', (SELECT e.world_day FROM environment e WHERE e.id = 1),
    'season', (SELECT e.season FROM environment e WHERE e.id = 1))
  FROM (SELECT 1) one LEFT JOIN resident r ON r.id = 1;
$$;

CREATE OR REPLACE FUNCTION api_governor() RETURNS jsonb LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT jsonb_build_object(
    'mode', (SELECT t.mode FROM ticks t ORDER BY t.id DESC LIMIT 1),
    'usage', (SELECT coalesce(jsonb_agg(to_jsonb(u) ORDER BY u.day DESC, u.provider), '[]') FROM usage_daily u WHERE u.day > current_date - 7),
    'tool_usage', (SELECT coalesce(jsonb_agg(to_jsonb(u) ORDER BY u.day DESC, u.tool), '[]') FROM tool_usage_daily u WHERE u.day > current_date - 7),
    'db_size_bytes', pg_database_size(current_database()),
    'recent_ticks', (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]') FROM (
       SELECT id, started_at, ended_at, mode, provider, ok, error FROM ticks ORDER BY id DESC LIMIT 20) t));
$$;

-- 8. Translation cache (presentation only; never read by the Resident). Cache forever: first write wins.
CREATE OR REPLACE FUNCTION translation_source(p_entity text, p_id bigint) RETURNS text
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT CASE p_entity
    WHEN 'log_entries' THEN (SELECT text FROM log_entries WHERE id = p_id AND NOT hidden)
    WHEN 'journal'     THEN (SELECT j.text FROM journal j LEFT JOIN log_entries l ON l.id = j.log_id WHERE j.id = p_id AND (j.log_id IS NULL OR NOT l.hidden))
    WHEN 'dreams'      THEN (SELECT text FROM dreams WHERE id = p_id)
    WHEN 'beliefs'     THEN (SELECT hypothesis FROM beliefs WHERE id = p_id)
    WHEN 'memories'    THEN (SELECT text FROM memories WHERE id = p_id)
    ELSE NULL END;
$$;

-- One round trip for the translate route: source text (NULL if missing/hidden) and the cached translation, if any.
CREATE OR REPLACE FUNCTION translation_lookup(p_entity text, p_id bigint, p_lang text) RETURNS jsonb
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT jsonb_build_object('source', translation_source(p_entity, p_id),
    'translated', (SELECT t.text FROM translations t WHERE t.entity = p_entity AND t.entity_id = p_id AND t.lang = p_lang),
    'engine', (SELECT t.engine FROM translations t WHERE t.entity = p_entity AND t.entity_id = p_id AND t.lang = p_lang));
$$;

CREATE OR REPLACE FUNCTION translation_put(p_entity text, p_id bigint, p_lang text, p_text text, p_engine text) RETURNS boolean
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE n int;
BEGIN
  IF p_lang NOT IN ('pt') OR coalesce(p_text, '') = '' OR translation_source(p_entity, p_id) IS NULL THEN RETURN false; END IF;
  INSERT INTO translations (entity, entity_id, lang, text, engine) VALUES (p_entity, p_id, p_lang, p_text, p_engine)
  ON CONFLICT (entity, entity_id, lang) DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n = 1;
END $$;

-- Daily cap for a counted resource (server-side translation): true and counted, or false once the cap is reached.
CREATE OR REPLACE FUNCTION usage_try(p_tool text, p_cap int) RETURNS boolean
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE n int;
BEGIN
  INSERT INTO tool_usage_daily (day, tool, calls) VALUES (current_date, p_tool, 1)
  ON CONFLICT (day, tool) DO UPDATE SET calls = tool_usage_daily.calls + 1 WHERE tool_usage_daily.calls < p_cap;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n = 1;
END $$;

-- 9. Audited admin actions: one transaction = the change + an append-only audit entry.
--    hide/unhide only flips the flag (never deletes). Flags are limited to the two gate keys.
CREATE OR REPLACE FUNCTION admin_hide(p_id bigint, p_hidden boolean) RETURNS boolean
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE ok boolean;
BEGIN
  ok := admin_set_hidden(p_id, p_hidden);
  IF ok THEN
    INSERT INTO log_entries (kind, category, text, data, caused_by)
    VALUES ('system', 'lab', CASE WHEN p_hidden THEN 'admin hid entry ' ELSE 'admin unhid entry ' END || p_id,
            jsonb_build_object('admin', CASE WHEN p_hidden THEN 'hide' ELSE 'unhide' END, 'target', p_id), p_id);
  END IF;
  RETURN ok;
END $$;

CREATE OR REPLACE FUNCTION admin_set_flag(p_action text, p_key text, p_value boolean) RETURNS void
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF p_key NOT IN ('paused', 'kill_switch') THEN
    RAISE EXCEPTION 'admin_set_flag: key not allowed' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  INSERT INTO kv (key, value) VALUES (p_key, to_jsonb(p_value))
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
  INSERT INTO log_entries (kind, category, text, data)
  VALUES ('system', 'lab', 'admin ' || p_action, jsonb_build_object('admin', p_action, 'key', p_key, 'value', p_value));
END $$;

-- Export page for admin (includes hidden rows, ascending, capped).
CREATE OR REPLACE FUNCTION admin_export(p_after bigint DEFAULT 0, p_lim int DEFAULT 500) RETURNS jsonb
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT coalesce(jsonb_agg(log_json(s) ORDER BY s.id), '[]') FROM (
    SELECT * FROM log_entries l WHERE l.id > coalesce(p_after, 0) ORDER BY l.id LIMIT least(greatest(coalesce(p_lim, 500), 1), 1000)) s;
$$;

-- 10. Grants: service_role only (new functions get no PUBLIC execute; grant explicitly).
DO $$
DECLARE f text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    FOREACH f IN ARRAY ARRAY[
      'log_json(log_entries)',
      'api_search(text, text, text[], text, timestamptz, timestamptz, int, bigint, double precision, text)',
      'api_context(bigint, int, int)', 'api_log(text, text, bigint, int)',
      'api_list(text, bigint, int, text, timestamptz, timestamptz)', 'api_trace(bigint)', 'api_status()', 'api_governor()',
      'translation_source(text, bigint)', 'translation_lookup(text, bigint, text)', 'translation_put(text, bigint, text, text, text)', 'usage_try(text, int)',
      'admin_hide(bigint, boolean)', 'admin_set_flag(text, text, boolean)', 'admin_export(bigint, int)'] LOOP
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', f);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
    END LOOP;
  END IF;
END $$;
