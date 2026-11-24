-- The guides redesign (lib/guideCommunity, lib/guideCredit, lib/guideRoutes, lib/playerItems):
-- route guides, Discord post selections, community setups and route-step suggestions, "used it"
-- votes, reports, tips, the Wanted board, tagged edit credit, monthly featured writers, route
-- follows, recent views, item skips and the budget cap, and the plugin's item snapshots (phase 2).
ALTER TABLE "guides" ADD COLUMN IF NOT EXISTS "kind" text DEFAULT 'guide' NOT NULL;
--> statement-breakpoint
ALTER TABLE "guides" ADD COLUMN IF NOT EXISTS "stale_note" text;
--> statement-breakpoint
ALTER TABLE "guides" ADD COLUMN IF NOT EXISTS "stale_at" text;
--> statement-breakpoint
ALTER TABLE "guide_posts" ADD COLUMN IF NOT EXISTS "selection" jsonb;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "guide_contributions" (
  "id" serial PRIMARY KEY NOT NULL,
  "guide_id" integer NOT NULL REFERENCES "guides"("id") ON DELETE CASCADE,
  "clan_id" integer REFERENCES "clans"("id") ON DELETE CASCADE,
  "kind" text DEFAULT 'setup' NOT NULL,
  "tier" text,
  "data" jsonb NOT NULL,
  "name" text NOT NULL,
  "notes" text,
  "author_user_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "status" text DEFAULT 'live' NOT NULL,
  "review_tag" text,
  "reviewed_by_user_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "reviewed_at" text,
  "wanted_id" integer,
  "first_to_write" boolean DEFAULT false NOT NULL,
  "created_at" text NOT NULL,
  "updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "guide_contributions_guide_idx" ON "guide_contributions" ("guide_id", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "guide_contributions_author_idx" ON "guide_contributions" ("author_user_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "guide_setup_votes" (
  "id" serial PRIMARY KEY NOT NULL,
  "guide_id" integer NOT NULL REFERENCES "guides"("id") ON DELETE CASCADE,
  "setup_key" text NOT NULL,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "account_id" integer REFERENCES "accounts"("id") ON DELETE SET NULL,
  "source" text DEFAULT 'manual' NOT NULL,
  "kc" integer DEFAULT 0 NOT NULL,
  "voter_clan_id" integer,
  "weight" real DEFAULT 0 NOT NULL,
  "created_at" text NOT NULL,
  "last_used_at" text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "guide_setup_votes_unique" ON "guide_setup_votes" ("guide_id", "setup_key", "user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "guide_setup_votes_used_idx" ON "guide_setup_votes" ("last_used_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "guide_reports" (
  "id" serial PRIMARY KEY NOT NULL,
  "contribution_id" integer REFERENCES "guide_contributions"("id") ON DELETE CASCADE,
  "tip_id" integer,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "reason" text NOT NULL,
  "created_at" text NOT NULL,
  "resolved_at" text
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "guide_reports_unique" ON "guide_reports" ("contribution_id", "tip_id", "user_id") NULLS NOT DISTINCT;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "guide_tips" (
  "id" serial PRIMARY KEY NOT NULL,
  "guide_id" integer NOT NULL REFERENCES "guides"("id") ON DELETE CASCADE,
  "clan_id" integer REFERENCES "clans"("id") ON DELETE CASCADE,
  "tier" text,
  "kind" text DEFAULT 'tip' NOT NULL,
  "text" text NOT NULL,
  "author_user_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "status" text DEFAULT 'live' NOT NULL,
  "created_at" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "guide_tips_guide_idx" ON "guide_tips" ("guide_id", "status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "guide_tip_votes" (
  "tip_id" integer NOT NULL REFERENCES "guide_tips"("id") ON DELETE CASCADE,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" text NOT NULL,
  PRIMARY KEY ("tip_id", "user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "guide_wanted" (
  "id" serial PRIMARY KEY NOT NULL,
  "guide_id" integer REFERENCES "guides"("id") ON DELETE CASCADE,
  "topic" text,
  "tier" text,
  "account_type" text,
  "build" text,
  "note" text,
  "reason" text DEFAULT 'request' NOT NULL,
  "requested_by_user_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "requesters" integer DEFAULT 1 NOT NULL,
  "status" text DEFAULT 'open' NOT NULL,
  "filled_by_contribution_id" integer,
  "filled_by_user_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "filled_at" text,
  "created_at" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "guide_wanted_status_idx" ON "guide_wanted" ("status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "guide_edit_credits" (
  "id" serial PRIMARY KEY NOT NULL,
  "guide_id" integer NOT NULL REFERENCES "guides"("id") ON DELETE CASCADE,
  "piece_key" text DEFAULT 'guide' NOT NULL,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "tag" text NOT NULL,
  "month" text NOT NULL,
  "version" integer,
  "reverted" boolean DEFAULT false NOT NULL,
  "proposal_id" integer,
  "contribution_id" integer,
  "created_at" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "guide_edit_credits_user_idx" ON "guide_edit_credits" ("user_id", "month");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "guide_edit_credits_proposal_unique" ON "guide_edit_credits" ("proposal_id") WHERE "proposal_id" IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "guide_edit_credits_contribution_unique" ON "guide_edit_credits" ("contribution_id") WHERE "contribution_id" IS NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "guide_writer_awards" (
  "id" serial PRIMARY KEY NOT NULL,
  "month" text NOT NULL,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "credit" real DEFAULT 0 NOT NULL,
  "featured" boolean DEFAULT true NOT NULL,
  "picked" boolean DEFAULT false NOT NULL,
  "reward_granted_at" text,
  "granted_by_user_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "guide_writer_awards_unique" ON "guide_writer_awards" ("month", "user_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "guide_route_follows" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "guide_id" integer NOT NULL REFERENCES "guides"("id") ON DELETE CASCADE,
  "manual_done" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_at" text NOT NULL,
  "updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "guide_route_follows_unique" ON "guide_route_follows" ("user_id", "guide_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "guide_views" (
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "guide_id" integer NOT NULL REFERENCES "guides"("id") ON DELETE CASCADE,
  "viewed_at" text NOT NULL,
  PRIMARY KEY ("user_id", "guide_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "guide_item_skips" (
  "id" serial PRIMARY KEY NOT NULL,
  "account_id" integer NOT NULL REFERENCES "accounts"("id") ON DELETE CASCADE,
  "item_id" integer NOT NULL,
  "reason" text DEFAULT 'cant_afford' NOT NULL,
  "created_at" text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "guide_item_skips_unique" ON "guide_item_skips" ("account_id", "item_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "guide_viewer_prefs" (
  "account_id" integer PRIMARY KEY NOT NULL REFERENCES "accounts"("id") ON DELETE CASCADE,
  "budget_cap" bigint,
  "updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "player_item_snapshots" (
  "account_id" integer NOT NULL REFERENCES "accounts"("id") ON DELETE CASCADE,
  "container" text NOT NULL,
  "items" jsonb NOT NULL,
  "read_at" text NOT NULL,
  "updated_at" text NOT NULL,
  PRIMARY KEY ("account_id", "container")
);
--> statement-breakpoint
INSERT INTO "guide_categories" ("clan_id", "key", "label", "icon", "sort_order", "requires_levels", "archived", "created_at", "updated_at")
VALUES (NULL, 'routes', 'Progression routes', '🧭', 5, false, false, to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
ON CONFLICT ON CONSTRAINT "guide_categories_clan_key_unique" DO NOTHING;
