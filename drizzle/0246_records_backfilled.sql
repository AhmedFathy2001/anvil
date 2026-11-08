-- Records are seeded once per account from member_daily_stats history (lib/records.ts
-- ensureRecordsBackfilled). NULL = not yet seeded.
ALTER TABLE "accounts" ADD COLUMN "records_backfilled_at" text;
