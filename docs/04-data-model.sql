-- Supabase Postgres. Migration 0001.
-- Writes: only the Worker via service_role key. Reads: only through the Worker API.
-- RLS enabled on every table with NO public policies (anon key gets nothing).

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS vector;           -- phase 2 embeddings

CREATE TABLE kv (key text PRIMARY KEY, value jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now());

-- One row. No names, no gender.
CREATE TABLE resident (
  id int PRIMARY KEY CHECK (id = 1),
  born_at timestamptz NOT NULL, phase text NOT NULL DEFAULT 'unaware',     -- descriptive label only
  station text, x real NOT NULL, z real NOT NULL, heading real NOT NULL,
  status text NOT NULL DEFAULT 'running',
  temperament jsonb NOT NULL,                  -- sensitivity, baselines, decay constants (seeded at genesis)
  organism jsonb NOT NULL,                     -- HIDDEN organism state (never in Resident prompts)
  physiology jsonb NOT NULL,                   -- derived body vector
  active_plan jsonb,
  last_tick_at timestamptz, seq bigint NOT NULL DEFAULT 0
);

-- Canonical append-only log of EVERYTHING (see doc 09)
CREATE TABLE log_entries (
  id bigserial PRIMARY KEY,
  ts timestamptz NOT NULL DEFAULT now(),
  tick_id bigint, kind text NOT NULL, category text NOT NULL CHECK (category IN ('life','lab')),
  text text NOT NULL DEFAULT '', data jsonb NOT NULL DEFAULT '{}',
  caused_by bigint REFERENCES log_entries(id),
  lang text NOT NULL DEFAULT 'en', hidden boolean NOT NULL DEFAULT false,
  tsv tsvector GENERATED ALWAYS AS (to_tsvector('english', coalesce(text,''))) STORED
);
CREATE INDEX log_tsv_idx   ON log_entries USING gin (tsv);
CREATE INDEX log_trgm_idx  ON log_entries USING gin (text gin_trgm_ops);
CREATE INDEX log_kind_ts   ON log_entries (kind, ts DESC);
CREATE INDEX log_cat_id    ON log_entries (category, id DESC);
CREATE INDEX log_cause_idx ON log_entries (caused_by);

-- Timeline consumed by the 3D viewer (append-only)
CREATE TABLE events (
  seq bigserial PRIMARY KEY, t_start timestamptz NOT NULL, t_end timestamptz NOT NULL,
  kind text NOT NULL, actor text NOT NULL, data jsonb NOT NULL,
  log_id bigint REFERENCES log_entries(id), v int NOT NULL DEFAULT 1
);
CREATE INDEX events_end_idx ON events (t_end);

CREATE TABLE ticks (
  id bigserial PRIMARY KEY, started_at timestamptz NOT NULL, ended_at timestamptz,
  mode text NOT NULL, provider text, ok boolean, error text
);

-- Decisions with intent / expectation / outcome (cause and consequence)
CREATE TABLE decisions (
  id bigserial PRIMARY KEY, tick_id bigint REFERENCES ticks(id), ts timestamptz NOT NULL DEFAULT now(),
  action jsonb NOT NULL, intent text NOT NULL, expectation text NOT NULL,
  outcome jsonb, outcome_review jsonb, prediction_error real
);

CREATE TABLE memories (
  id bigserial PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now(),
  kind text NOT NULL,                               -- discovery|experience|dream|lesson|reflection
  text text NOT NULL, source_url text, importance real NOT NULL DEFAULT 0.5, topic text,
  appraisal jsonb, body_snapshot jsonb,             -- state at encoding, used for affective recall
  last_recalled_at timestamptz, recall_count int NOT NULL DEFAULT 0,
  embedding vector(384),                            -- phase 2
  tsv tsvector GENERATED ALWAYS AS (to_tsvector('english', coalesce(text,'') || ' ' || coalesce(topic,''))) STORED
);
CREATE INDEX memories_tsv_idx ON memories USING gin (tsv);

CREATE TABLE lessons (          -- learned if-then rules
  id bigserial PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now(),
  situation text NOT NULL, rule text NOT NULL, decision_id bigint REFERENCES decisions(id),
  times_confirmed int NOT NULL DEFAULT 0, times_violated int NOT NULL DEFAULT 0
);

CREATE TABLE questions (
  id bigserial PRIMARY KEY, text text NOT NULL, origin_log_id bigint REFERENCES log_entries(id),
  priority real NOT NULL DEFAULT 0.5, status text NOT NULL DEFAULT 'open',  -- open|explored|dropped
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE goals (
  id bigserial PRIMARY KEY, text text NOT NULL, status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz   -- created only by the Resident
);
CREATE TABLE journal (id bigserial PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now(), text text NOT NULL, log_id bigint REFERENCES log_entries(id));
CREATE TABLE dreams  (id bigserial PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now(), text text NOT NULL, source_memory_ids bigint[] NOT NULL, spawned_question text);
CREATE TABLE beliefs (id bigserial PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now(), hypothesis text NOT NULL, confidence real NOT NULL, evidence text);

-- Lab data
CREATE TABLE organism_samples (id bigserial PRIMARY KEY, ts timestamptz NOT NULL DEFAULT now(), tick_id bigint, organism jsonb NOT NULL, physiology jsonb NOT NULL, emotion_top3 jsonb);
CREATE TABLE appraisals (id bigserial PRIMARY KEY, ts timestamptz NOT NULL DEFAULT now(), tick_id bigint, stimulus_log_id bigint REFERENCES log_entries(id), dims jsonb NOT NULL, source text NOT NULL); -- rules|interpreter
CREATE TABLE llm_traces (
  id bigserial PRIMARY KEY, ts timestamptz NOT NULL DEFAULT now(), tick_id bigint, role text NOT NULL,   -- resident|interpreter|dream|translate
  provider text NOT NULL, model text NOT NULL, system_prompt text, messages jsonb, response text,
  tokens_in int, tokens_out int, latency_ms int, finish_reason text, ok boolean NOT NULL, archived_ref text  -- set when moved to object storage
);
CREATE TABLE tool_calls (id bigserial PRIMARY KEY, ts timestamptz NOT NULL DEFAULT now(), tick_id bigint, tool text NOT NULL, input jsonb, status int, bytes int, ok boolean, error text);

CREATE TABLE world_entities (id text PRIMARY KEY, type text NOT NULL, x real, z real, health real, appearance jsonb NOT NULL, props jsonb, updated_at timestamptz NOT NULL DEFAULT now());

CREATE TABLE usage_daily (day date NOT NULL, provider text NOT NULL, calls int NOT NULL DEFAULT 0, tokens_in bigint NOT NULL DEFAULT 0, tokens_out bigint NOT NULL DEFAULT 0, errors int NOT NULL DEFAULT 0, PRIMARY KEY (day, provider));
CREATE TABLE tool_usage_daily (day date NOT NULL, tool text NOT NULL, calls int NOT NULL DEFAULT 0, PRIMARY KEY (day, tool));

CREATE TABLE translations (  -- presentation cache, never read by the Resident
  entity text NOT NULL, entity_id bigint NOT NULL, lang text NOT NULL, text text NOT NULL, engine text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (entity, entity_id, lang),
  tsv tsvector GENERATED ALWAYS AS (to_tsvector('portuguese', coalesce(text,''))) STORED
);
CREATE INDEX translations_tsv_idx ON translations USING gin (tsv);

-- Global search used by GET /api/search
CREATE FUNCTION search_log(q text, kinds text[] DEFAULT NULL, cat text DEFAULT NULL, from_ts timestamptz DEFAULT NULL, to_ts timestamptz DEFAULT NULL, lim int DEFAULT 30, before_id bigint DEFAULT NULL)
RETURNS TABLE (id bigint, ts timestamptz, kind text, category text, text text, data jsonb, caused_by bigint, rank real)
LANGUAGE sql STABLE AS $$
  SELECT l.id, l.ts, l.kind, l.category, l.text, l.data, l.caused_by,
         ts_rank(l.tsv, websearch_to_tsquery('english', q)) + similarity(l.text, q) * 0.2 AS rank
  FROM log_entries l
  WHERE NOT l.hidden
    AND (l.tsv @@ websearch_to_tsquery('english', q) OR l.text % q)
    AND (kinds IS NULL OR l.kind = ANY(kinds)) AND (cat IS NULL OR l.category = cat)
    AND (from_ts IS NULL OR l.ts >= from_ts) AND (to_ts IS NULL OR l.ts <= to_ts)
    AND (before_id IS NULL OR l.id < before_id)
  ORDER BY rank DESC, l.id DESC LIMIT lim;
$$;

-- Lock down: enable RLS everywhere, add no policies (service_role bypasses RLS).
-- ALTER TABLE <each table above> ENABLE ROW LEVEL SECURITY;  (generate in migration)

-- Body, survival and world economy (doc 10). Hidden from Resident prompts.
ALTER TABLE resident ADD COLUMN vitals jsonb NOT NULL DEFAULT '{}';      -- BodyState (life bar, needs, temps, wounds)
ALTER TABLE resident ADD COLUMN skills jsonb NOT NULL DEFAULT '{}';
CREATE TABLE inventory (item text PRIMARY KEY, qty real NOT NULL, condition real, props jsonb);
CREATE TABLE item_types (id text PRIMARY KEY, category text NOT NULL, props jsonb NOT NULL);   -- nutrition, toxicity, insulation, spoil rate...
CREATE TABLE resource_nodes (
  id text PRIMARY KEY, type text NOT NULL, x real NOT NULL, z real NOT NULL,
  capacity real NOT NULL, amount real NOT NULL, regrowth_per_day real NOT NULL, season_mod jsonb, last_update timestamptz NOT NULL
);
CREATE TABLE environment (id int PRIMARY KEY CHECK (id = 1), world_day int NOT NULL, season text NOT NULL, weather text NOT NULL, ambient_temp real NOT NULL, wind real NOT NULL, updated_at timestamptz NOT NULL);
CREATE TABLE fires (id bigserial PRIMARY KEY, x real NOT NULL, z real NOT NULL, fuel real NOT NULL, state text NOT NULL, lit_at timestamptz NOT NULL);
CREATE TABLE deaths (id bigserial PRIMARY KEY, died_at timestamptz NOT NULL, cause text NOT NULL, report jsonb NOT NULL);

-- Phase 3
CREATE TABLE materials (name text PRIMARY KEY, props jsonb NOT NULL);
CREATE TABLE blueprints (id text PRIMARY KEY, name text NOT NULL, category text NOT NULL, components jsonb NOT NULL, visual jsonb NOT NULL, acoustic jsonb, durability real, efficiency real, discovered_at timestamptz NOT NULL DEFAULT now());
