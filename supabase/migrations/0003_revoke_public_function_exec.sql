-- Migration 0003: close function EXECUTE for PUBLIC/anon/authenticated (hard rule 5).
-- 0002 revoked from PUBLIC before the functions existed, and ALTER DEFAULT PRIVILEGES only affects the role that
-- runs it, so functions created later kept the default PUBLIC execute grant (reachable by anon via PostgREST RPC).
-- Our functions are SECURITY INVOKER with a pinned search_path; only service_role (Worker) may execute them.
-- Extension-owned functions (pgvector, pg_trgm...) are out of scope.
DO $$
DECLARE f record; r text;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid = 'pg_proc'::regclass AND d.objid = p.oid AND d.deptype = 'e')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', f.sig);
    FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %I', f.sig, r);
      END IF;
    END LOOP;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig);
    END IF;
  END LOOP;
END $$;

-- Future functions: cover every role that may create objects in public. Roles we are not allowed to alter
-- (e.g. supabase_admin on the hosted platform, not ours to configure) are skipped; the existing-function
-- sweep above plus the schema test guard those.
DO $$
DECLARE c text; r text;
BEGIN
  FOREACH c IN ARRAY ARRAY['postgres','supabase_admin'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = c) THEN
      BEGIN
        EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC', c);
        FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
          IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
            EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM %I', c, r);
          END IF;
        END LOOP;
      EXCEPTION WHEN insufficient_privilege THEN
        RAISE NOTICE 'skipped default privileges for role %', c;
      END;
    END IF;
  END LOOP;
END $$;
-- PUBLIC's default is database-wide too; the global form (no IN SCHEMA) is what removes the implicit PUBLIC grant.
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
