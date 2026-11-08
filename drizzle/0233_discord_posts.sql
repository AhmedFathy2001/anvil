-- Board posts kept so they can be edited or deleted later (lib/discordPosts): which webhook sent
-- which message for which submission / tile completion / team win.
CREATE TABLE IF NOT EXISTS "discord_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"clan_id" integer,
	"kind" text NOT NULL,
	"event_id" integer,
	"tile_id" integer,
	"team_id" integer,
	"submission_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"webhook_url" text NOT NULL,
	"message_id" text NOT NULL,
	"channel_id" text,
	"created_at" text NOT NULL,
	"edited_at" text,
	"deleted_at" text,
	CONSTRAINT "discord_posts_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action
);
CREATE INDEX IF NOT EXISTS "discord_posts_tile_team_idx" ON "discord_posts" USING btree ("tile_id","team_id");
CREATE INDEX IF NOT EXISTS "discord_posts_event_idx" ON "discord_posts" USING btree ("event_id");
-- The submissions buffered into a pending merged post, so that post can be found from any of them.
ALTER TABLE "pending_notifications" ADD COLUMN IF NOT EXISTS "submission_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;
