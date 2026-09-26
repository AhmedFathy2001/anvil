-- The guides module: in-game guides in Discord markdown, an Anvil library every clan sees, clan
-- copies that follow it or fork from it, and the Discord messages each guide was posted as.
-- See the note on `guides` in db/schema.ts.
ALTER TABLE "clan_staff" ADD COLUMN IF NOT EXISTS "can_edit_guides" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "platform_guide_editor" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "guides" (
  "id" serial PRIMARY KEY NOT NULL,
  "clan_id" integer REFERENCES "clans"("id") ON DELETE cascade,
  "slug" text NOT NULL,
  "title" text NOT NULL,
  "summary" text DEFAULT '' NOT NULL,
  "category" text DEFAULT 'general' NOT NULL,
  "cover_url" text,
  "body" text DEFAULT '' NOT NULL,
  "status" text DEFAULT 'draft' NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "source_guide_id" integer REFERENCES "guides"("id") ON DELETE set null,
  "source_version" integer,
  "follows_source" boolean DEFAULT false NOT NULL,
  "created_by_user_id" integer REFERENCES "users"("id") ON DELETE set null,
  "updated_by_user_id" integer REFERENCES "users"("id") ON DELETE set null,
  "created_at" text NOT NULL,
  "updated_at" text NOT NULL,
  "published_at" text,
  CONSTRAINT "guides_clan_slug_unique" UNIQUE NULLS NOT DISTINCT("clan_id","slug")
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "guides_clan_source_unique" ON "guides" ("clan_id","source_guide_id") WHERE source_guide_id is not null;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "guides_source_idx" ON "guides" ("source_guide_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "guide_revisions" (
  "id" serial PRIMARY KEY NOT NULL,
  "guide_id" integer NOT NULL REFERENCES "guides"("id") ON DELETE cascade,
  "version" integer NOT NULL,
  "title" text NOT NULL,
  "summary" text DEFAULT '' NOT NULL,
  "body" text NOT NULL,
  "note" text,
  "edited_by_user_id" integer REFERENCES "users"("id") ON DELETE set null,
  "created_at" text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "guide_revisions_guide_version_unique" ON "guide_revisions" ("guide_id","version");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "guide_posts" (
  "id" serial PRIMARY KEY NOT NULL,
  "clan_id" integer NOT NULL REFERENCES "clans"("id") ON DELETE cascade,
  "guide_id" integer NOT NULL REFERENCES "guides"("id") ON DELETE cascade,
  "channel_id" text NOT NULL,
  "channel_name" text,
  "channel_kind" text DEFAULT 'text' NOT NULL,
  "thread_id" text,
  "message_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "posted_version" integer DEFAULT 0 NOT NULL,
  "content_hash" text,
  "auto_update" boolean DEFAULT true NOT NULL,
  "last_error" text,
  "posted_by_user_id" integer REFERENCES "users"("id") ON DELETE set null,
  "created_at" text NOT NULL,
  "updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "guide_posts_guide_idx" ON "guide_posts" ("guide_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "guide_posts_clan_idx" ON "guide_posts" ("clan_id");
