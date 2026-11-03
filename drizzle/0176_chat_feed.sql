-- The in-game chat feed (lib/chatFeed): the event switch, each person's choices, who is guesting where
-- right now, and the senders' dedup keys.
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "chat_feed" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "chat_feed_prefs" text;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "guest_presence" (
	"account_id" integer PRIMARY KEY NOT NULL REFERENCES "accounts"("id") ON DELETE cascade,
	"user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"clan_id" integer NOT NULL REFERENCES "clans"("id") ON DELETE cascade,
	"seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "guest_presence_clan_idx" ON "guest_presence" USING btree ("clan_id","seen_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "feed_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" integer NOT NULL REFERENCES "accounts"("id") ON DELETE cascade,
	"dedup_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "feed_items_account_key_idx" ON "feed_items" USING btree ("account_id","dedup_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feed_items_created_idx" ON "feed_items" USING btree ("created_at");
