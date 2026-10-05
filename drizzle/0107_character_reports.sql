-- Clans raise character problems to Anvil instead of rewriting the character themselves.
-- See schema.ts `characterReports`.
CREATE TABLE IF NOT EXISTS "character_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" integer NOT NULL REFERENCES "accounts"("id") ON DELETE cascade,
	"clan_id" integer REFERENCES "clans"("id") ON DELETE set null,
	"reported_by_user_id" integer REFERENCES "users"("id") ON DELETE set null,
	"claimant_player_id" integer REFERENCES "players"("id") ON DELETE set null,
	"kind" text DEFAULT 'other' NOT NULL,
	"body" text,
	"status" text DEFAULT 'open' NOT NULL,
	"resolution" text,
	"resolved_by_user_id" integer REFERENCES "users"("id") ON DELETE set null,
	"resolved_at" text,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "character_reports_open_idx" ON "character_reports" USING btree ("status","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "character_reports_account_idx" ON "character_reports" USING btree ("account_id");
