#!/usr/bin/env bash
# Concurrency test for resolve_scholarly_works (migration 20261005000000).
# Starts many sessions that resolve the same new DOI at the same instant and
# checks that exactly one canonical work exists for it afterwards.
# Usage: PSQL="psql -d <local database>" supabase/tests/scholarly_works_concurrency.sh [sessions]
set -euo pipefail
PSQL=${PSQL:?set PSQL to a psql command for a disposable local database}
SESSIONS=${1:-24}
RUN="c$(date +%s%N)"
DOI="10.9999/${RUN}"
TITLE="Concurrency probe ${RUN}"
RECORD="[{\"identifiers\":{\"doi\":\"${DOI}\"},\"assertedBy\":[\"crossref\"],\"identitySource\":\"crossref\",\"identityPriority\":70,\"fields\":{\"title\":\"${TITLE}\",\"normalizedTitle\":\"${TITLE,,}\",\"authors\":[\"A. Author\"],\"publicationYear\":2024}}]"
START=$(( $(date +%s) + 2 ))
pids=()
for _ in $(seq "$SESSIONS"); do
  # Each session waits for the same wall-clock second, then resolves.
  $PSQL -qAt -v ON_ERROR_STOP=1 -c "set role service_role; select pg_sleep(greatest(0, ${START} - extract(epoch from clock_timestamp()))); select public.resolve_scholarly_works('${RECORD}'::jsonb)->0->>'workId';" > /dev/null &
  pids+=($!)
done
failed=0
for pid in "${pids[@]}"; do wait "$pid" || failed=$((failed + 1)); done
works=$($PSQL -qAt -c "select count(*) from public.scholarly_works where title = '${TITLE}'")
linked=$($PSQL -qAt -c "select count(distinct work_id) from public.scholarly_work_identifiers where scheme = 'doi' and value = '${DOI}'")
echo "sessions=${SESSIONS} failed_sessions=${failed} works_for_title=${works} works_for_doi=${linked}"
if [ "$failed" -ne 0 ] || [ "$works" -ne 1 ] || [ "$linked" -ne 1 ]; then echo "FAIL concurrent resolutions of one DOI did not yield exactly one work"; exit 1; fi
echo "PASS ${SESSIONS} concurrent resolutions of one DOI yielded exactly one work"
