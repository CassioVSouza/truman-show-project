-- Migration 0007: anonymous live viewers count (decision 42).
-- Stores only a SHA-256 hash of a random per-browser token (hashed by the Worker) and a timestamp: no IP, no account, no personal data.
-- Not part of the log, never read by the Resident. RLS closed, no policies; only service_role (the Worker) reaches it, via one RPC.
-- UNLOGGED: presence is disposable (a crash just empties it), and it saves WAL.
SET search_path = public;

CREATE UNLOGGED TABLE IF NOT EXISTS viewer_presence (
  token_hash text PRIMARY KEY CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  last_seen  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS viewer_presence_seen_idx ON viewer_presence (last_seen);
ALTER TABLE viewer_presence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON viewer_presence FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON viewer_presence TO service_role;

-- One call per heartbeat: upsert this viewer, prune stale rows (~2% of beats; cheap, indexed), return the live count.
-- SECURITY DEFINER so the pruning DELETE does not need a DELETE grant for service_role (the schema test forbids it).
CREATE OR REPLACE FUNCTION api_viewer_beat(p_token_hash text, p_window_seconds int DEFAULT 120) RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE w interval := make_interval(secs => least(greatest(coalesce(p_window_seconds, 120), 30), 600));
BEGIN
  INSERT INTO viewer_presence (token_hash, last_seen) VALUES (p_token_hash, now())
    ON CONFLICT (token_hash) DO UPDATE SET last_seen = excluded.last_seen;
  IF random() < 0.02 THEN
    DELETE FROM viewer_presence WHERE last_seen < now() - interval '10 minutes';
  END IF;
  RETURN (SELECT count(*)::int FROM viewer_presence WHERE last_seen >= now() - w);
END $$;
REVOKE ALL ON FUNCTION api_viewer_beat(text, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION api_viewer_beat(text, int) TO service_role;
