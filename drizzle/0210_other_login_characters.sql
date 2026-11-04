-- OTHER LOGINS ON A CHARACTER: per-day sightings for the event fair-play check, and ownership claims
-- ("This is my account" from the plugin). Additive and safe to run twice.
--
-- account_sighting_days: one row per (character, other Anvil login, UTC day) the character was played
-- through a login that does not own it. The fair-play check (lib/footprintCheck) reads only the days
-- inside an event's window; the existing account_sightings row stays the owner-facing summary.
--
-- account_ownership_claims: a login asking for a character somebody else has claimed. 'objection'
-- mode moves it after a 7-day window unless the owner objects; 'approval' mode needs the owner's yes.
-- At most one open (or approved-but-waiting) claim per character.

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

CREATE TABLE IF NOT EXISTS "account_ownership_claims" (
  "id" serial PRIMARY KEY NOT NULL,
  "account_id" integer NOT NULL REFERENCES "accounts"("id") ON DELETE CASCADE,
  "claimant_user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "claimant_player_id" integer NOT NULL REFERENCES "players"("id") ON DELETE CASCADE,
  "owner_player_id" integer NOT NULL REFERENCES "players"("id") ON DELETE CASCADE,
  "mode" text NOT NULL,
  "status" text DEFAULT 'open' NOT NULL,
  "claim_hash" text,
  "created_at" text NOT NULL,
  "deadline_at" text,
  "decided_at" text,
  "decided_by_user_id" integer REFERENCES "users"("id") ON DELETE SET NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "account_ownership_claims_open_unique" ON "account_ownership_claims" USING btree ("account_id") WHERE status in ('open', 'approved');--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "account_ownership_claims_claimant_idx" ON "account_ownership_claims" USING btree ("claimant_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "account_ownership_claims_owner_idx" ON "account_ownership_claims" USING btree ("owner_player_id");
