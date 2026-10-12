-- A player's own goals from the plugin's You tab (schema playerGoals). Progress is never stored.
CREATE TABLE IF NOT EXISTS "player_goals" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" integer NOT NULL REFERENCES "accounts"("id") ON DELETE CASCADE,
	"kind" text NOT NULL,
	"metric" text NOT NULL,
	"target" integer NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "player_goals_unique" ON "player_goals" ("account_id","kind","metric");
