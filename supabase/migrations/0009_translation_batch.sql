-- Migration 0009 (decision 50): support for the background translation batch. NOT yet applied.
--  * translation_untranslated: newest Resident-text rows without a cached translation (hidden entries excluded).
--  * usage_try_reserved: like usage_try but leaves a reserve of the daily cap for on-demand viewer requests.
--  * usage_refund: gives one slot back when a translation attempt failed (never below zero).
-- Presentation cache only; the Resident never reads it. Nothing is deleted from the log.
SET search_path = public, extensions;

CREATE OR REPLACE FUNCTION translation_untranslated(p_lim int DEFAULT 5, p_lang text DEFAULT 'pt', p_max_chars int DEFAULT 1800)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) FROM (
    SELECT * FROM (
      SELECT CASE l.kind WHEN 'journal' THEN 'journal' WHEN 'dream' THEN 'dreams' WHEN 'belief' THEN 'beliefs' ELSE 'log_entries' END AS entity,
             l.id, l.text, 0 AS src
      FROM log_entries l
      WHERE NOT l.hidden
        AND (l.kind IN ('thought','action','journal','dream','belief','idea') OR (l.kind = 'tool_call' AND l.data->>'tool' = 'web_search'))
        AND l.id > (SELECT coalesce(max(id), 0) FROM log_entries) - 3000
        AND l.text IS NOT NULL AND btrim(l.text) <> '' AND length(l.text) <= p_max_chars
        AND NOT EXISTS (SELECT 1 FROM translations t
                        WHERE t.lang = p_lang AND t.entity_id = l.id
                          AND t.entity = CASE l.kind WHEN 'journal' THEN 'journal' WHEN 'dream' THEN 'dreams' WHEN 'belief' THEN 'beliefs' ELSE 'log_entries' END)
      UNION ALL
      SELECT 'memories', m.id, m.text, 1
      FROM memories m
      WHERE m.id > (SELECT coalesce(max(id), 0) FROM memories) - 1000
        AND m.text IS NOT NULL AND btrim(m.text) <> '' AND length(m.text) <= p_max_chars
        AND NOT EXISTS (SELECT 1 FROM translations t WHERE t.lang = p_lang AND t.entity = 'memories' AND t.entity_id = m.id)
    ) u ORDER BY u.src, u.id DESC LIMIT least(greatest(coalesce(p_lim, 5), 1), 20)
  ) x;
$$;

CREATE OR REPLACE FUNCTION usage_try_reserved(p_tool text, p_cap int, p_reserve int) RETURNS boolean
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RETURN usage_try(p_tool, greatest(p_cap - greatest(coalesce(p_reserve, 0), 0), 0));
END $$;

CREATE OR REPLACE FUNCTION usage_refund(p_tool text) RETURNS boolean
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE n int;
BEGIN
  UPDATE tool_usage_daily SET calls = calls - 1 WHERE day = current_date AND tool = p_tool AND calls > 0;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n = 1;
END $$;

DO $$
DECLARE f text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    FOREACH f IN ARRAY ARRAY['translation_untranslated(int, text, int)', 'usage_try_reserved(text, int, int)', 'usage_refund(text)'] LOOP
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', f);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
    END LOOP;
  END IF;
END $$;
