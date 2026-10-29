-- History of Admin → Post to Discord messages, so each can be edited or deleted later. Expand-only.
CREATE TABLE IF NOT EXISTS "discord_broadcasts" (
	"id" serial PRIMARY KEY NOT NULL,
	"clan_id" integer NOT NULL REFERENCES "clans"("id") ON DELETE CASCADE,
	"channel_id" text NOT NULL,
	"message_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"title" text,
	"body" text NOT NULL,
	"as_embed" boolean DEFAULT true NOT NULL,
	"color_hex" text,
	"mention_role_id" text,
	"sent_by_user_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"edited_at" timestamp with time zone,
	"deleted_at" timestamp with time zone
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "discord_broadcasts_clan_created_idx" ON "discord_broadcasts" USING btree ("clan_id","created_at");
