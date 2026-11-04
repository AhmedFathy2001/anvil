-- Head-to-head challenges (lib/h2h): one player against another, first to a drop or most kills / XP
-- in a set time. Bragging rights only: no stake, prize or money column exists, by design.
CREATE TABLE IF NOT EXISTS "h2h_challenges" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"stat_key" text,
	"item_ids" text,
	"label" text NOT NULL,
	"duration_min" integer NOT NULL,
	"challenger_player_id" integer NOT NULL REFERENCES "players"("id") ON DELETE CASCADE,
	"challenger_account_id" integer NOT NULL REFERENCES "accounts"("id") ON DELETE CASCADE,
	"challenger_user_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
	"opponent_player_id" integer NOT NULL REFERENCES "players"("id") ON DELETE CASCADE,
	"opponent_account_id" integer NOT NULL REFERENCES "accounts"("id") ON DELETE CASCADE,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"respond_by" timestamp with time zone NOT NULL,
	"started_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"challenger_baseline" text,
	"opponent_baseline" text,
	"challenger_score" bigint DEFAULT 0 NOT NULL,
	"opponent_score" bigint DEFAULT 0 NOT NULL,
	"challenger_hit_at" timestamp with time zone,
	"opponent_hit_at" timestamp with time zone,
	"result" text,
	"challenger_public" boolean DEFAULT false NOT NULL,
	"opponent_public" boolean DEFAULT false NOT NULL,
	"cancel_requested_by" integer REFERENCES "players"("id") ON DELETE SET NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "h2h_challenger_idx" ON "h2h_challenges" ("challenger_player_id", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "h2h_opponent_idx" ON "h2h_challenges" ("opponent_player_id", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "h2h_challenger_account_idx" ON "h2h_challenges" ("challenger_account_id", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "h2h_opponent_account_idx" ON "h2h_challenges" ("opponent_account_id", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "h2h_status_idx" ON "h2h_challenges" ("status", "ends_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "h2h_prefs" (
	"player_id" integer PRIMARY KEY NOT NULL REFERENCES "players"("id") ON DELETE CASCADE,
	"closed" boolean DEFAULT false NOT NULL,
	"blocked" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
