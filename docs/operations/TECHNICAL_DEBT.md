# Technical debt register

Known issues recorded for later work. Entries here are not fixed by the change
that recorded them.

## TD-1: `idea_verifications` is not created by any repository migration

- **Recorded:** 2026-10-05, during Slice 2A local verification.
- **Observed:** Applying every file in `supabase/migrations/` in order to a fresh
  Postgres fails on two migrations with `relation "public.idea_verifications"
  does not exist`:
  - `20260824123640_enable_rls_idea_verifications.sql`
  - `20260915101707_harden_idea_verification_read_policy.sql`
  All other migrations, including Slices 0, 1 and 2A, apply cleanly.
- **Cause (inferred):** the table exists in production (the production
  tenant-isolation script reads and writes it) but was created outside the
  repository migrations, so the repository cannot rebuild the production schema
  from scratch. `20260908233328_harden_public_data_api_grants.sql` already guards
  it with `to_regclass`, which hides the gap.
- **Risk:** a new environment (staging, local, disaster recovery) built from the
  migrations would lack `idea_verifications` and its policies; schema drift
  between production and the repository can go unnoticed.
- **Not done:** no change in Slice 2A. A fix needs the production table
  definition (columns, constraints, indexes, policies, grants) captured
  read-only from production and added as an idempotent `create table if not
  exists` migration ordered before `20260824123640`, then verified against a
  fresh database.
