-- Migration 0008 (decision 48): fix list/log read paths and add the Resident's search history.
--  * api_log was ASCENDING after an id, so viewers asking for "the last 40 thoughts" got the OLDEST 40 forever.
--    It is now newest first with a `before` cursor.
--  * tick_commit never wrote the journal/dreams/beliefs tables, so those lists were empty. They are now read from the
--    append-only log (kinds journal, dream, belief) which is the source of truth (and honours `hidden`).
--  * New list 'searches' (kind tool_call, data.tool = web_search), written by the log writer.
-- Append-only is unchanged; nothing is deleted or updated.
SET search_path = public, extensions;

DROP FUNCTION IF EXISTS api_log(text, text, bigint, int);
DROP FUNCTION IF EXISTS api_log(text, text, bigint, bigint, int);
-- p_lang <> 'en' adds `translated` (cached translation of the entry text, null when none; hidden entries stay excluded).
-- The entity key matches translation_untranslated/translation_source (journal, dreams, beliefs, else log_entries).
CREATE OR REPLACE FUNCTION api_log(p_kind text DEFAULT NULL, p_cat text DEFAULT NULL, p_before bigint DEFAULT NULL,
                                   p_after bigint DEFAULT 0, p_lim int DEFAULT 50, p_lang text DEFAULT 'en')
RETURNS jsonb LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT coalesce(jsonb_agg(log_json(s) || jsonb_build_object('translated',
      (SELECT t.text FROM translations t WHERE p_lang <> 'en' AND t.lang = p_lang AND t.entity_id = s.id
         AND t.entity = CASE s.kind WHEN 'journal' THEN 'journal' WHEN 'dream' THEN 'dreams' WHEN 'belief' THEN 'beliefs' ELSE 'log_entries' END))
    ORDER BY s.id DESC), '[]') FROM (
    SELECT * FROM log_entries l
    WHERE NOT l.hidden AND l.id > coalesce(p_after, 0) AND (p_before IS NULL OR l.id < p_before)
      AND (p_kind IS NULL OR l.kind = p_kind) AND (p_cat IS NULL OR l.category = p_cat)
    ORDER BY l.id DESC LIMIT least(greatest(coalesce(p_lim, 50), 1), 200)) s;
$$;

CREATE OR REPLACE FUNCTION api_list(p_what text, p_before bigint DEFAULT NULL, p_lim int DEFAULT 30, p_lang text DEFAULT 'en',
                                    p_from timestamptz DEFAULT NULL, p_to timestamptz DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path = public, extensions AS $$
DECLARE n int := least(greatest(coalesce(p_lim, 30), 1), 100); r jsonb;
BEGIN
  IF p_what = 'journal' THEN
    -- Source of truth is the append-only log (kind 'journal'); the legacy `journal` table is never written by tick_commit.
    SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.id DESC), '[]') INTO r FROM (
      SELECT l.id, l.ts AS created_at, l.text, l.id AS log_id,
             (SELECT t.text FROM translations t WHERE p_lang <> 'en' AND t.entity = 'journal' AND t.entity_id = l.id AND t.lang = p_lang) AS translated
      FROM log_entries l
      WHERE l.kind = 'journal' AND NOT l.hidden AND (p_before IS NULL OR l.id < p_before) ORDER BY l.id DESC LIMIT n) s;
  ELSIF p_what = 'dreams' THEN
    SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.id DESC), '[]') INTO r FROM (
      SELECT l.id, l.ts AS created_at, l.text, (l.data->>'spawned_question') AS spawned_question,
             (SELECT t.text FROM translations t WHERE p_lang <> 'en' AND t.entity = 'dreams' AND t.entity_id = l.id AND t.lang = p_lang) AS translated
      FROM log_entries l
      WHERE l.kind = 'dream' AND NOT l.hidden AND (p_before IS NULL OR l.id < p_before) ORDER BY l.id DESC LIMIT n) s;
  ELSIF p_what = 'beliefs' THEN
    SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.id DESC), '[]') INTO r FROM (
      SELECT l.id, l.ts AS created_at, l.text AS hypothesis,
             CASE WHEN jsonb_typeof(l.data->'confidence') = 'number' THEN (l.data->>'confidence')::float8 ELSE NULL END AS confidence,
             l.data->>'evidence' AS evidence,
             (SELECT t.text FROM translations t WHERE p_lang <> 'en' AND t.entity = 'beliefs' AND t.entity_id = l.id AND t.lang = p_lang) AS translated
      FROM log_entries l
      WHERE l.kind = 'belief' AND NOT l.hidden AND (p_before IS NULL OR l.id < p_before) ORDER BY l.id DESC LIMIT n) s;
  ELSIF p_what = 'searches' THEN
    -- The Resident's web searches, newest first. Hidden entries are excluded.
    SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.id DESC), '[]') INTO r FROM (
      SELECT l.id, l.ts, l.tick_id, l.text AS query, coalesce((l.data->>'ok')::boolean, false) AS ok,
             CASE WHEN jsonb_typeof(l.data->'status') = 'number' THEN (l.data->>'status')::int ELSE NULL END AS status,
             CASE WHEN jsonb_typeof(l.data->'results') = 'array' THEN l.data->'results' ELSE '[]'::jsonb END AS results,
             l.caused_by,
             (SELECT t.text FROM translations t WHERE p_lang <> 'en' AND t.entity = 'log_entries' AND t.entity_id = l.id AND t.lang = p_lang) AS translated
      FROM log_entries l
      WHERE l.kind = 'tool_call' AND l.data->>'tool' = 'web_search' AND NOT l.hidden AND (p_before IS NULL OR l.id < p_before)
      ORDER BY l.id DESC LIMIT n) s;
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


CREATE INDEX IF NOT EXISTS log_tool_search_idx ON log_entries (id DESC) WHERE kind = 'tool_call';

CREATE OR REPLACE FUNCTION translation_source(p_entity text, p_id bigint) RETURNS text
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT CASE p_entity
    WHEN 'log_entries' THEN (SELECT text FROM log_entries WHERE id = p_id AND NOT hidden)
    WHEN 'journal'     THEN (SELECT text FROM log_entries WHERE id = p_id AND kind = 'journal' AND NOT hidden)
    WHEN 'dreams'      THEN (SELECT text FROM log_entries WHERE id = p_id AND kind = 'dream' AND NOT hidden)
    WHEN 'beliefs'     THEN (SELECT text FROM log_entries WHERE id = p_id AND kind = 'belief' AND NOT hidden)
    WHEN 'memories'    THEN (SELECT text FROM memories WHERE id = p_id)
    ELSE NULL END;
$$;

DO $$
DECLARE f text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    FOREACH f IN ARRAY ARRAY['api_log(text, text, bigint, bigint, int, text)',
      'api_list(text, bigint, int, text, timestamptz, timestamptz)', 'translation_source(text, bigint)'] LOOP
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', f);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
    END LOOP;
  END IF;
END $$;
