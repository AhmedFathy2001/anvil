-- Ghost clans: the in-game clan each character's plugin reports, member by member, whether or not
-- that clan uses Anvil (lib/gameClans). Expand-only — two new tables, nothing existing touched.
CREATE TABLE IF NOT EXISTS "game_clans" (
	"id" serial PRIMARY KEY NOT NULL,
	"name_key" text NOT NULL,
	"name" text NOT NULL,
	"first_seen_at" text NOT NULL,
	"last_seen_at" text NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "game_clans_name_key_unique" ON "game_clans" USING btree ("name_key");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "account_game_clans" (
	"account_id" integer PRIMARY KEY NOT NULL REFERENCES "accounts"("id") ON DELETE cascade,
	"game_clan_id" integer REFERENCES "game_clans"("id") ON DELETE set null,
	"rank" integer,
	"title" text,
	"joined_on" text,
	"observed_at" text NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "account_game_clans_clan_idx" ON "account_game_clans" USING btree ("game_clan_id");
