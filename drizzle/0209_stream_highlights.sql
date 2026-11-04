-- STREAM HIGHLIGHTS (lib/highlights): Twitch clips and VOD timestamps of a streamed event's big
-- moments. Additive and safe to run twice.
--
-- One row per (event, beat, channel): a big drop or pet, a finished tile, the first full board, the
-- start, the winner, a head-to-head won. The clip is made by the Anvil bot's own Twitch token (never a
-- host's or a player's), only while the channel is LIVE; the VOD link is worked out later, once the
-- stream's archive exists. A row with neither a clip nor a VOD link is never shown.

CREATE TABLE IF NOT EXISTS "stream_highlights" (
  "id" serial PRIMARY KEY NOT NULL,
  "event_id" integer NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,
  "clan_id" integer NOT NULL REFERENCES "clans"("id") ON DELETE CASCADE,
  -- 'moment' | 'tile' | 'board' | 'start' | 'won' | 'h2h'
  "beat" text NOT NULL,
  -- What the beat is about, for dedupe: 'moment:12', 'tile:4:7', 'board', 'start', 'won', 'h2h:9'.
  "ref_key" text NOT NULL,
  -- 'twitch' | 'youtube'
  "platform" text NOT NULL,
  -- 'host' (the space's connected channel) | 'player' (a player's own linked Twitch, opted in)
  "channel_owner" text NOT NULL,
  "channel_id" text NOT NULL,
  "channel_name" text NOT NULL,
  "user_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "team_id" integer REFERENCES "teams"("id") ON DELETE SET NULL,
  "tile_id" integer REFERENCES "tiles"("id") ON DELETE CASCADE,
  "moment_id" integer REFERENCES "moments"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "occurred_at" timestamp with time zone NOT NULL,
  -- 'pending' | 'ready' | 'failed' | 'limited' | 'off' | 'none' (YouTube: no clips, a VOD link only)
  "clip_status" text DEFAULT 'pending' NOT NULL,
  "clip_id" text,
  "clip_url" text,
  "thumbnail_url" text,
  "duration_s" real,
  "vod_url" text,
  -- 'pending' | 'ready' | 'none'
  "vod_status" text DEFAULT 'pending' NOT NULL,
  "vod_attempts" integer DEFAULT 0 NOT NULL,
  "vod_next_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "stream_highlights_dedupe" ON "stream_highlights" USING btree ("event_id","ref_key","platform","channel_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stream_highlights_event_idx" ON "stream_highlights" USING btree ("event_id","occurred_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stream_highlights_clan_idx" ON "stream_highlights" USING btree ("clan_id","occurred_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stream_highlights_moment_idx" ON "stream_highlights" USING btree ("moment_id") WHERE moment_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stream_highlights_vod_due_idx" ON "stream_highlights" USING btree ("vod_next_at") WHERE vod_status = 'pending';--> statement-breakpoint

-- The Anvil bot's Twitch user token, as the SITE holds it (the chat bot process keeps its own copy in
-- memory). Seeded from TWITCH_BOT_REFRESH_TOKEN; seed_hash notices the owner re-running the helper.
-- Encrypted with TWITCH_TOKEN_KEY. scope is what Twitch's /validate said the token carries.
CREATE TABLE IF NOT EXISTS "twitch_bot_tokens" (
  "id" text PRIMARY KEY NOT NULL,
  "seed_hash" text NOT NULL,
  "access_token" text,
  "refresh_token" text NOT NULL,
  "expires_at" text,
  "scope" text DEFAULT '' NOT NULL,
  "bot_user_id" text,
  "updated_at" text NOT NULL
);--> statement-breakpoint

-- The host's two choices. Auto-clip is ON by default: it only does anything once a Twitch (or
-- YouTube) channel is connected, which a host does to stream. Promotion is OFF until they say yes.
ALTER TABLE "clans" ADD COLUMN IF NOT EXISTS "highlights_auto_clip" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "clans" ADD COLUMN IF NOT EXISTS "highlights_promo" boolean DEFAULT false NOT NULL;--> statement-breakpoint

-- A player's own choice: clip MY stream when I hit a big moment in a streamed event. Off by default;
-- it lives on the Twitch link, so unlinking Twitch forgets it.
ALTER TABLE "user_twitch_links" ADD COLUMN IF NOT EXISTS "clip_my_moments" boolean DEFAULT false NOT NULL;
