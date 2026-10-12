-- When the sweep last asked the hiscores about an account (lib/pollLadder sweepDue): a plugin that is
-- pushing keeps the account fresh, so the sweep only reconciles it every ~6h — and polls it once as
-- soon as the pushes stop. Nullable, no default: null reads as "never polled", which is due.
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "stats_polled_at" text;
