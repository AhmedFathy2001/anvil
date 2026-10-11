-- A claimed character played through ANOTHER login's plugin (lib/accountSightings): siblings on one
-- RuneLite, a friend at your PC, or a wrong link. Evidence only — never changes ownership.
CREATE TABLE IF NOT EXISTS "account_sightings" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" integer NOT NULL REFERENCES "accounts"("id") ON DELETE CASCADE,
	"user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"hash_matched" integer DEFAULT 0 NOT NULL,
	"first_seen_at" text NOT NULL,
	"last_seen_at" text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "account_sightings_account_user_unique" ON "account_sightings" ("account_id","user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "account_sightings_user_idx" ON "account_sightings" ("user_id");
