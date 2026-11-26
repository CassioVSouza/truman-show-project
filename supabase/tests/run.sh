#!/usr/bin/env bash
# Runs migrations + tests in a throwaway Supabase Postgres container (has pgvector and anon/authenticated/service_role).
# Usage: supabase/tests/run.sh [image]   (default: public.ecr.aws/supabase/postgres:17.6.1.171, any local supabase/postgres tag works)
# Needs Docker. No keys, no network access to Supabase cloud.
set -euo pipefail
IMAGE="${1:-public.ecr.aws/supabase/postgres:17.6.1.171}"
NAME="truman-schema-test-$$"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT
docker run -d --name "$NAME" -e POSTGRES_PASSWORD=test "$IMAGE" >/dev/null
for _ in $(seq 1 60); do docker exec "$NAME" pg_isready -U postgres -h localhost >/dev/null 2>&1 && break; sleep 2; done
sleep 3
psql_() { docker exec -i "$NAME" psql -U supabase_admin -h localhost -d postgres -v ON_ERROR_STOP=1 -q "$@"; }
# SKIP_MIGRATION=0004 reproduces the pre-fix state (service_role stripped, as on hosted) to prove the test catches it.
for f in "$HERE"/migrations/*.sql; do
  if [ -n "${SKIP_MIGRATION:-}" ] && [[ "$f" == *"/$SKIP_MIGRATION"* ]]; then echo "== skip $f"; psql_ -c "REVOKE ALL ON ALL TABLES IN SCHEMA public FROM service_role; REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM service_role"; continue; fi
  echo "== $f"; psql_ < "$f"; done
echo "== tests"; psql_ -t < "$HERE/tests/schema_test.sql"
