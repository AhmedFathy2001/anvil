-- When the hiscores mode tables were last walked for this account's game mode (lib/forgeFetchQueue,
-- Forge-only). Set when a probe settles, including the "not a solo ironman, mode unknown" outcome
-- that leaves account_type null — so a regular or group account is not re-probed every drain.
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "account_type_probed_at" text;
-- The probe's candidate scan: accounts nobody has typed or probed yet.
CREATE INDEX IF NOT EXISTS "accounts_type_unprobed_idx" ON "accounts" ("id")
  WHERE "account_type" IS NULL AND "account_type_probed_at" IS NULL;
