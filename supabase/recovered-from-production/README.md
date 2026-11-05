# Recovered from the production migration history

These files were fetched on 5 Nov 2026 with
`supabase migration fetch --remote=zwbtgwgthbyddvurmefk` from the production
database's `supabase_migrations.schema_migrations` table. They were applied to
production but their original files were never committed.

They are kept here, **not** in `supabase/migrations/`, because:

- the history table stores statements in a normalised form, so these are not
  byte-identical to the originals and do not pass
  `src/lib/__tests__/migration-text-safety.test.ts`;
- production already has them applied; replaying them would duplicate policies.

## Known gap

Production also has these tables, which no migration (committed or in the
history table) creates. They were created outside the migration history:

`claims`, `claim_supports`, `evidence_items`, `gap_assessments`,
`research_integrity_events`, `research_search_results`, `research_search_runs`,
`scholarly_works`, `scholarly_work_identifiers`, `scholarly_work_observations`.

The test suite expects `20261005000000_scholarly_works.sql`, which is lost. To
close the gap, dump the production schema (`supabase db dump --schema public`,
needs Docker) and turn the definitions of these tables into a committed
migration.
