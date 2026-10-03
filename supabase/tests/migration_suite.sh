#!/usr/bin/env bash
# Regression suite for the research-intelligence migrations from 20261006000000
# onward, on disposable local databases. Never point it at production.
#
# For each way a migration can be submitted (psql statement by statement, one
# multi-statement query as the Supabase SQL editor sends it, one explicit
# transaction) it builds a fresh database with the earlier migrations, applies
# each new migration twice (idempotency) and then runs every
# supabase/tests/slice*.test.sql file, each of which rolls itself back.
#
# Usage (as a user that can create databases): supabase/tests/migration_suite.sh
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
FIRST_NEW=20261006000000
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
failures=0

for mode in file single_query transaction; do
  db="research_suite_${mode}"
  dropdb --if-exists "$db" >/dev/null 2>&1 || true; createdb "$db"
  psql -q -d "$db" -f "$ROOT/supabase/tests/local-bootstrap.sql" >/dev/null 2>&1
  for m in "$ROOT"/supabase/migrations/*.sql; do
    name=$(basename "$m")
    if [[ "$name" < "$FIRST_NEW" ]]; then
      # Two older migrations need idea_verifications, which no migration
      # creates (docs/operations/TECHNICAL_DEBT.md, TD-1).
      psql -q -d "$db" -f "$m" >/dev/null 2>&1 || true
      continue
    fi
    cp "$m" "$WORK/m.sql"
    for attempt in 1 2; do
      case "$mode" in
        file) cmd=(psql -q -v ON_ERROR_STOP=1 -d "$db" -f "$WORK/m.sql") ;;
        single_query) cmd=(psql -q -v ON_ERROR_STOP=1 -d "$db" -c "$(cat "$WORK/m.sql")") ;;
        transaction) cmd=(psql -q -v ON_ERROR_STOP=1 -1 -d "$db" -f "$WORK/m.sql") ;;
      esac
      if "${cmd[@]}" >/dev/null 2>"$WORK/err"; then echo "PASS [$mode] $name apply $attempt"
      else echo "FAIL [$mode] $name apply $attempt: $(grep -v NOTICE "$WORK/err" | head -2)"; failures=$((failures + 1)); fi
    done
  done
  for t in "$ROOT"/supabase/tests/slice*.test.sql; do
    [ -e "$t" ] || continue
    if psql -q -v ON_ERROR_STOP=1 -d "$db" -f "$t" >"$WORK/out" 2>&1 && grep -q "ALL CHECKS PASSED" "$WORK/out"; then
      echo "PASS [$mode] $(basename "$t") ($(grep -c 'NOTICE:  PASS' "$WORK/out") checks)"
    else
      echo "FAIL [$mode] $(basename "$t"): $(grep -E 'FAILED|ERROR' "$WORK/out" | head -2)"; failures=$((failures + 1))
    fi
  done
  dropdb "$db"
done
if [ "$failures" -ne 0 ]; then echo "MIGRATION SUITE: $failures failure(s)"; exit 1; fi
echo "MIGRATION SUITE: all checks passed"
