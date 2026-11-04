-- OTHER LOGINS ON A CHARACTER: per-day sightings for the event fair-play check, in-site notices, and
-- ownership claims ("This is my account" from the plugin). Additive and safe to run twice.
--
-- account_sighting_days: one row per (character, other Anvil login, UTC day) the character was played,
-- with its anchored account hash, through a login that does not own it. The fair-play check
-- (lib/footprintCheck) reads only the days inside an event's window.
--
-- user_notices: a notice on the site for one login — the record that the owner was told.
--
-- account_ownership_claims: a login asking for a character somebody else has claimed. It starts
-- 'verifying' (the claimant must pass the XP-gain check, verification_attempts); only then is the owner
-- told. 'objection' mode moves it after 7 days unless the owner objects; 'approval' mode needs the
-- owner's yes; 'staff' mode is for Anvil staff. At most one claim in flight per character.

CREATE TABLE IF NOT EXISTS "account_sighting_days" (
  "id" serial PRIMARY KEY NOT NULL,
  "account_id" integer NOT NULL REFERENCES "accounts"("id") ON DELETE CASCADE,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "day" text NOT NULL,
  "hash_matched" integer DEFAULT 0 NOT NULL,
  "first_at" text NOT NULL,
  "last_at" text NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "account_sighting_days_unique" ON "account_sighting_days" USING btree ("account_id","user_id","day");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "account_sighting_days_account_day_idx" ON "account_sighting_days" USING btree ("account_id","day");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "user_notices" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "kind" text NOT NULL,
  "ref_id" integer,
  "title" text NOT NULL,
  "body" text NOT NULL,
  "created_at" text NOT NULL,
  "read_at" text
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_notices_user_idx" ON "user_notices" USING btree ("user_id","read_at");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "account_ownership_claims" (
  "id" serial PRIMARY KEY NOT NULL,
  "account_id" integer NOT NULL REFERENCES "accounts"("id") ON DELETE CASCADE,
  "claimant_user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "claimant_player_id" integer NOT NULL REFERENCES "players"("id") ON DELETE CASCADE,
  "owner_player_id" integer NOT NULL REFERENCES "players"("id") ON DELETE CASCADE,
  "mode" text,
  "status" text DEFAULT 'verifying' NOT NULL,
  "verification_attempt_id" integer REFERENCES "verification_attempts"("id") ON DELETE SET NULL,
  "verified_at" text,
  "owner_notice_id" integer REFERENCES "user_notices"("id") ON DELETE SET NULL,
  "staff_report_id" integer REFERENCES "character_reports"("id") ON DELETE SET NULL,
  "created_at" text NOT NULL,
  "deadline_at" text,
  "decided_at" text,
  "decided_by_user_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "transfer_started_at" text
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "account_ownership_claims_live_unique" ON "account_ownership_claims" USING btree ("account_id") WHERE status in ('verifying', 'open', 'approved', 'transferring');--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "account_ownership_claims_claimant_idx" ON "account_ownership_claims" USING btree ("claimant_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "account_ownership_claims_owner_idx" ON "account_ownership_claims" USING btree ("owner_player_id");
