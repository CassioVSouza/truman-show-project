-- Initialize the singleton and its stored state in the same transaction as the creation log and event.
CREATE FUNCTION public.admin_start_resident(
  p_holder text, p_born_at timestamptz, p_mind jsonb, p_vitals jsonb
) RETURNS text LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  entry_id bigint;
BEGIN
  -- Hold the shared lease row until the transaction commits. This also rejects requests that arrive after expiry.
  PERFORM 1 FROM kv
    WHERE key = 'lease' AND value->>'holder' = p_holder
      AND (value->>'expires_at')::timestamptz > clock_timestamp()
    FOR UPDATE;
  IF NOT FOUND THEN RETURN 'busy'; END IF;

  INSERT INTO resident (id, born_at, station, x, z, heading, temperament, organism, physiology, vitals, skills)
  VALUES (1, p_born_at, p_mind->>'station', (p_mind#>>'{pos,x}')::real, (p_mind#>>'{pos,z}')::real,
          (p_mind#>>'{pos,heading}')::real, p_mind#>'{organism,temperament}', p_mind#>'{organism,state}',
          p_mind->'physiology', p_vitals, p_mind->'skills')
  ON CONFLICT (id) DO NOTHING;
  IF NOT FOUND THEN RETURN 'already_started'; END IF;

  -- Plain INSERT fails closed if a previous state's keys exist. Existing admin flags are preserved.
  INSERT INTO kv (key, value) VALUES ('world_seed', p_mind->'seed'), ('mind', p_mind);

  INSERT INTO log_entries (ts, kind, category, text, data)
  VALUES (p_born_at, 'system', 'lab', 'admin start', '{"admin":"start"}')
  RETURNING id INTO entry_id;

  INSERT INTO events (t_start, t_end, kind, actor, data, log_id)
  VALUES (p_born_at, p_born_at, 'status', 'world', jsonb_build_object('status', api_status()->'status'), entry_id);

  RETURN 'started';
END $$;

REVOKE ALL ON FUNCTION public.admin_start_resident(text, timestamptz, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_start_resident(text, timestamptz, jsonb, jsonb) TO service_role;
