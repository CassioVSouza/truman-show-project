-- Migration 0004: grant the Worker role (service_role) the table/sequence privileges 0002/0003 never gave it.
-- Bug: 0002 revoked everything and enabled RLS but service_role (BYPASSRLS) had no table GRANTs -> 403
-- "permission denied for table resident". Least privilege: SELECT/INSERT/UPDATE only, NO DELETE/TRUNCATE
-- (append-only log, death permanent; pruning is done by archive_confirm_traces which UPDATEs stubs).
-- anon/authenticated/PUBLIC keep NOTHING (hard rule 5). archive_reader stays SELECT-only (0002).
-- Future tables: new tables need a GRANT in their own migration; the schema test fails if a table lacks it
-- (default privileges for supabase_admin cannot be set on hosted, so the test is the guard).
-- Reset to a known state first (platform defaults may have granted ALL incl. DELETE/TRUNCATE), then grant least privilege.
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM service_role;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM service_role;
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Best effort for objects created later by the migration role (skipped where not permitted).
DO $$
DECLARE c text;
BEGIN
  FOREACH c IN ARRAY ARRAY['postgres','supabase_admin'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = c) THEN
      BEGIN
        EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT SELECT, INSERT, UPDATE ON TABLES TO service_role', c);
        EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO service_role', c);
      EXCEPTION WHEN insufficient_privilege THEN
        RAISE NOTICE 'skipped default privileges for role %', c;
      END;
    END IF;
  END LOOP;
END $$;

-- Re-assert anon/authenticated closed (idempotent; covers tables/sequences created since 0002).
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', r);
    END IF;
  END LOOP;
END $$;
