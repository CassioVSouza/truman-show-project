# Supabase: applying the migrations

Migrations live in `supabase/migrations/` and must run in order:
`0001_schema.sql`, `0002_security_and_functions.sql`, `0003_revoke_public_function_exec.sql`, `0004_grant_service_role.sql`, then `0005_read_api.sql` (read API, translation cache, audited admin functions; drops the old `search_log`/`search_translations`). Local test of all migrations: `supabase/tests/run.sh` (needs Docker).

Cloud project: `https://suadfgpoprtormoomqyw.supabase.co` (project ref `suadfgpoprtormoomqyw`).

Worker `SUPABASE_URL` is the BASE URL only: `https://suadfgpoprtormoomqyw.supabase.co`
(no `/rest/v1/`, no trailing slash). The Worker adds the path itself.

Never paste keys or the DB password into files, chat or git.

## Path A (preferred): Supabase CLI

1. Install the CLI (needs Node): use `npx supabase@latest <command>` for every command below
   (or install it from https://supabase.com/docs/guides/cli).
2. Open a terminal in the repo root (`D:\TrumanShowProject`).
3. Log in (opens a browser): `npx supabase@latest login`
4. Link the project: `npx supabase@latest link --project-ref suadfgpoprtormoomqyw`
   When asked for the database password, type it in the terminal. It is the password you
   chose when creating the project (reset it in Dashboard > Project Settings > Database if lost).
   It stays in your terminal only; do not save it anywhere in the repo.
5. Preview: `npx supabase@latest db push --linked --dry-run` (should list 0001 and 0002).
6. Apply: `npx supabase@latest db push --linked`, answer `y`.

Always pass `--linked`: without it a dry run was seen defaulting to the local stack instead of the
cloud project. Check the target before answering `y`.

If the CLI later asks for the password again, set it for that terminal session only
(PowerShell: `$env:SUPABASE_DB_PASSWORD = "..."`), and close the terminal afterwards.

## Path B (fallback): SQL editor

1. Dashboard > SQL Editor > New query.
2. Paste the full contents of `supabase/migrations/0001_schema.sql`, click Run. Wait for success.
3. New query, paste `supabase/migrations/0002_security_and_functions.sql`, Run.
4. Do not run them twice or out of order. If one errors, stop and report the exact message.

(With path B the CLI migration history is not recorded; use one path only, do not mix.)

## Verify (SQL editor, run each, read-only)

```sql
-- 1. RLS on for every public table: expect zero rows
select tablename from pg_tables
where schemaname = 'public' and not rowsecurity;

-- 2. tick_commit exists: expect one row
select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and proname = 'tick_commit';

-- 3. pgvector and pg_trgm enabled: expect two rows (vector, pg_trgm)
select extname from pg_extension where extname in ('vector', 'pg_trgm');

-- 4. anon / authenticated cannot read or run anything: expect all false
select has_table_privilege('anon', 'public.log_entries', 'select')          as anon_select,
       has_table_privilege('authenticated', 'public.log_entries', 'select') as auth_select,
       has_function_privilege('anon', 'public.tick_commit(jsonb)', 'execute') as anon_exec;

-- 5. no public policies for anon/authenticated: expect zero rows
select tablename, policyname from pg_policies
where schemaname = 'public' and (roles && array['anon','authenticated','public']::name[]);
```

## Later (not now)

The archive Action's read-only role `archive_reader` is created NOLOGIN by 0002. Its login
password is set once in the SQL editor and stored only as a GitHub secret (see the comment in 0002).
