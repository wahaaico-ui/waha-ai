#!/usr/bin/env bash
# Regression test for migration 20261005000000 (Slice 2A) on disposable local
# databases. Never point it at production.
#
# For each way a migration can be submitted (psql statement by statement, one
# multi-statement query as the Supabase SQL editor sends it, one explicit
# transaction) it builds a fresh database, applies the migration twice, and
# checks that public.resolve_scholarly_works(jsonb) exists (to_regprocedure),
# has the intended signature and service-role-only privileges, and that the
# tables, column and RLS exist. It then reproduces the production failure
# (the function definition missing from the submitted text) and checks the
# migration fails with an explicit message and leaves nothing behind.
#
# Usage (as a user that can create databases): supabase/tests/scholarly_works_migration.sh
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
MIGRATION="$ROOT/supabase/migrations/20261005000000_scholarly_works.sql"
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
cp "$MIGRATION" "$WORK/migration.sql"
failures=0

fresh_db() {
  dropdb --if-exists "$1" >/dev/null 2>&1; createdb "$1"
  psql -q -d "$1" -f "$ROOT/supabase/tests/local-bootstrap.sql" >/dev/null 2>&1
  for m in "$ROOT"/supabase/migrations/*.sql; do
    case "$m" in *20261005000000_scholarly_works.sql) continue ;; esac
    # Two older migrations need idea_verifications, which no migration creates
    # (docs/operations/TECHNICAL_DEBT.md, TD-1); they are not needed here.
    psql -q -d "$1" -f "$m" >/dev/null 2>&1 || true
  done
  [ "$(psql -qAt -d "$1" -c "select to_regclass('public.research_search_results') is not null")" = t ] || { echo "FAIL prerequisite tables missing"; exit 1; }
}

apply() { # db mode file
  case "$2" in
    file) psql -q -v ON_ERROR_STOP=1 -d "$1" -f "$3" ;;
    single_query) psql -q -v ON_ERROR_STOP=1 -d "$1" -c "$(cat "$3")" ;;
    transaction) psql -q -v ON_ERROR_STOP=1 -1 -d "$1" -f "$3" ;;
  esac
}

check() { # db label sql-returning-t
  if [ "$(psql -qAt -d "$1" -c "$3")" = t ]; then echo "PASS [$4] $2"; else echo "FAIL [$4] $2"; failures=$((failures + 1)); fi
}

for mode in file single_query transaction; do
  db="s2a_migration_${mode}"
  fresh_db "$db"
  apply "$db" "$mode" "$WORK/migration.sql" >/dev/null 2>"$WORK/err" || { echo "FAIL [$mode] first apply: $(grep -v NOTICE "$WORK/err" | head -2)"; failures=$((failures + 1)); }
  apply "$db" "$mode" "$WORK/migration.sql" >/dev/null 2>"$WORK/err" || { echo "FAIL [$mode] repeated apply: $(grep -v NOTICE "$WORK/err" | head -2)"; failures=$((failures + 1)); }
  check "$db" "to_regprocedure('public.resolve_scholarly_works(jsonb)') is not null" "select to_regprocedure('public.resolve_scholarly_works(jsonb)') is not null" "$mode"
  check "$db" "signature is (p_records jsonb) returns jsonb, one overload" "select count(*) = 1 and bool_and(pg_get_function_identity_arguments(oid) = 'p_records jsonb' and prorettype = 'jsonb'::regtype) from pg_proc where proname = 'resolve_scholarly_works' and pronamespace = 'public'::regnamespace" "$mode"
  check "$db" "service_role can execute, anon and authenticated cannot" "select has_function_privilege('service_role', 'public.resolve_scholarly_works(jsonb)', 'execute') and not has_function_privilege('anon', 'public.resolve_scholarly_works(jsonb)', 'execute') and not has_function_privilege('authenticated', 'public.resolve_scholarly_works(jsonb)', 'execute')" "$mode"
  check "$db" "PUBLIC has no execute privilege" "select not exists (select 1 from aclexplode((select proacl from pg_proc where oid = 'public.resolve_scholarly_works(jsonb)'::regprocedure)) where grantee = 0)" "$mode"
  check "$db" "tables exist with RLS enabled" "select count(*) = 2 and bool_and(relrowsecurity) from pg_class where oid in (to_regclass('public.scholarly_works'), to_regclass('public.scholarly_work_identifiers'))" "$mode"
  check "$db" "browser roles have no table privileges" "select not (has_table_privilege('anon', 'public.scholarly_works', 'select') or has_table_privilege('authenticated', 'public.scholarly_works', 'select') or has_table_privilege('anon', 'public.scholarly_work_identifiers', 'insert') or has_table_privilege('authenticated', 'public.scholarly_work_identifiers', 'insert'))" "$mode"
  check "$db" "research_search_results.work_id exists and is nullable" "select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'research_search_results' and column_name = 'work_id' and is_nullable = 'YES')" "$mode"
  check "$db" "the resolver runs as service_role" "set role service_role; select (public.resolve_scholarly_works('[]'::jsonb)) = '[]'::jsonb" "$mode"
  for role in anon authenticated; do
    if psql -qAt -v ON_ERROR_STOP=1 -d "$db" -c "set role $role; select public.resolve_scholarly_works('[]'::jsonb)" >/dev/null 2>"$WORK/err"; then
      echo "FAIL [$mode] $role could execute the resolver"; failures=$((failures + 1))
    elif grep -q "permission denied for function resolve_scholarly_works" "$WORK/err"; then
      echo "PASS [$mode] $role is refused executing the resolver"
    else
      echo "FAIL [$mode] $role: unexpected error $(head -1 "$WORK/err")"; failures=$((failures + 1))
    fi
  done
  dropdb "$db"
done

# The production failure: the CREATE FUNCTION statement does not reach the
# database. The migration must stop with an explicit error and roll back.
python3 - "$WORK/migration.sql" "$WORK/without-function.sql" <<'PY'
import sys
sql = open(sys.argv[1]).read()
start = sql.index('create or replace function public.resolve_scholarly_works')
end = sql.index('$resolve_scholarly_works$;', start) + len('$resolve_scholarly_works$;')
open(sys.argv[2], 'w').write(sql[:start] + sql[end:])
PY
db="s2a_migration_missing_function"
fresh_db "$db"
if apply "$db" single_query "$WORK/without-function.sql" >/dev/null 2>"$WORK/err"; then
  echo "FAIL [missing function] migration succeeded without the resolver"; failures=$((failures + 1))
elif grep -q "public.resolve_scholarly_works(jsonb) was not created" "$WORK/err"; then
  echo "PASS [missing function] migration fails with an explicit message"
else
  echo "FAIL [missing function] unexpected error: $(grep -v NOTICE "$WORK/err" | head -1)"; failures=$((failures + 1))
fi
check "$db" "nothing from the failed migration remains" "select to_regclass('public.scholarly_works') is null and to_regclass('public.scholarly_work_identifiers') is null and to_regprocedure('public.resolve_scholarly_works(jsonb)') is null and not exists (select 1 from information_schema.columns where table_name = 'research_search_results' and column_name = 'work_id')" "missing function"
dropdb "$db"

if [ "$failures" -ne 0 ]; then echo "MIGRATION REGRESSION: $failures failure(s)"; exit 1; fi
echo "MIGRATION REGRESSION: all checks passed"
