-- Undoing a bulk post: remember what Anvil created in Discord for it (the category, forum and
-- channels), and which posts came from it. See `guide_bulk_runs` in db/schema.ts.
CREATE TABLE IF NOT EXISTS "guide_bulk_runs" (
  "id" serial PRIMARY KEY NOT NULL,
  "clan_id" integer NOT NULL REFERENCES "clans"("id") ON DELETE cascade,
  "layout" text NOT NULL,
  "label" text NOT NULL,
  "category_id" text,
  "forum_id" text,
  "channel_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_by_user_id" integer REFERENCES "users"("id") ON DELETE set null,
  "created_at" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "guide_bulk_runs_clan_idx" ON "guide_bulk_runs" ("clan_id");
--> statement-breakpoint
ALTER TABLE "guide_posts" ADD COLUMN IF NOT EXISTS "owns_channel" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "guide_posts" ADD COLUMN IF NOT EXISTS "bulk_run_id" integer;
