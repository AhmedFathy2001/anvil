-- CONNECTED ACCOUNTS: anyone can link Twitch / YouTube / Kick / Medal from settings and show them on
-- their profile. Additive and safe to run twice.
--
-- Twitch, YouTube and Kick reuse the existing identity-only link tables (user_twitch_links,
-- user_youtube_links, user_kick_links — each already unique on the platform id). Medal is new: it has
-- no OAuth, so a link starts unverified and is unique on the Medal id only once verified.

CREATE TABLE IF NOT EXISTS "user_medal_links" (
	"user_id" integer PRIMARY KEY NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"medal_user_id" text,
	"medal_username" text,
	"verified_at" text,
	"linked_at" text NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_medal_links_verified_unique" ON "user_medal_links" USING btree ("medal_user_id") WHERE verified_at is not null;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "user_connected_prefs" (
	"user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"platform" text NOT NULL,
	"show_on_profile" boolean NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "user_connected_prefs_pk" PRIMARY KEY("user_id","platform")
);
