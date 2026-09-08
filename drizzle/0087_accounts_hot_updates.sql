-- THE WIDEST ROW IN THE DATABASE, REWRITTEN EVERY TIME THE SWEEP LOOKS AT IT.
--
-- `accounts` averages ~2 KB a row, and 1.6 KB of that is `stats_last_snapshot` — a hiscores blob
-- almost nothing reads. The sweep touches every account it polls (miss streak, next-due stamp) even
-- when the member gained nothing, so Postgres rewrote the whole tuple each time. Measured on
-- production: 29,598 updates across 541 rows in four days, only 45% of them HOT.
--
-- Three storage changes, no application change:
--
--   1. The due index carried `stats_next_due_at`, which the sweep writes on EVERY poll. An update to
--      an indexed column can never be HOT, so each poll also inserted an entry into all six of this
--      table's indexes. Nothing needs the column indexed — the sweep loads its candidates by seat
--      and decides due-ness in JS (api/cron/stats); the only query the index served filters on
--      `status`, which is what replaces it.
--   2. toast_tuple_target pushes the fat stat blobs out of line at 512 bytes instead of ~2 KB, so
--      the tuple the sweep rewrites is the small half. An out-of-line value that did not change is
--      not rewritten with the row.
--   3. fillfactor leaves room on the page for the new tuple version, which is what HOT needs.
--
-- Existing rows reorganise as they are next updated, which for an account in the sweep is within
-- two hours. No backfill, and nothing to roll back beyond restoring the old index.
DROP INDEX IF EXISTS "accounts_due_idx";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "accounts_status_idx" ON "accounts" USING btree ("status");--> statement-breakpoint
ALTER TABLE "accounts" SET (fillfactor = 85, toast_tuple_target = 512);
