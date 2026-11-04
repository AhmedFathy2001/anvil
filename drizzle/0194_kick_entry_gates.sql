-- Kick for creator spaces (lib/gates/kick*): entry gates for the host's Kick followers or subscribers,
-- and `!join` in their Kick chat. Additive only.
--
-- Kick's public API cannot answer "does X follow / subscribe to Y?" (docs.kick.com has no such
-- endpoint), so Anvil remembers what Kick TELLS it by webhook from the moment the host connects:
-- follow and subscription events, and the sub badge on a chat message carrying a viewer's one-time
-- link code. Timestamps are ISO text written by the app (lib/dbTime reads them).

-- A creator space's Kick channel, connected by its broadcaster through Kick OAuth (PKCE). Tokens are
-- encrypted with lib/secretBox under KICK_TOKEN_KEY and never leave the server.
CREATE TABLE IF NOT EXISTS "clan_kick_channels" (
  "clan_id" integer PRIMARY KEY NOT NULL REFERENCES "clans"("id") ON DELETE CASCADE,
  "kick_user_id" text NOT NULL,
  "kick_slug" text NOT NULL,
  "access_token" text NOT NULL,
  "refresh_token" text NOT NULL,
  "expires_at" text NOT NULL,
  "scope" text NOT NULL,
  "linked_by_user_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
  -- Kick refused a refresh: the host has to connect again. Checks on new facts still work (they come
  -- by webhook), but `!join` replies and re-subscribing stop until then.
  "broken_at" text,
  -- The host says their Kick chat is followers-only, so a code typed there proves a follow.
  "followers_only_chat" boolean DEFAULT false NOT NULL,
  -- `!join` in this channel's chat is switched on.
  "chat_join" boolean DEFAULT false NOT NULL,
  "connected_at" text NOT NULL,
  "updated_at" text NOT NULL
);
CREATE INDEX IF NOT EXISTS "clan_kick_channels_kick_user_idx" ON "clan_kick_channels" USING btree ("kick_user_id");

-- A viewer's Kick account, proved by typing a one-time code in a connected channel's chat. One Kick
-- account per Anvil login, so one subscription cannot let a crowd of alts through.
CREATE TABLE IF NOT EXISTS "user_kick_links" (
  "user_id" integer PRIMARY KEY NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "kick_user_id" text NOT NULL,
  "kick_username" text NOT NULL,
  "linked_at" text NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "user_kick_links_kick_user_unique" ON "user_kick_links" USING btree ("kick_user_id");

-- One-time link codes (ANVIL-XXXXXX). Single use, short-lived, one live code per login.
CREATE TABLE IF NOT EXISTS "kick_link_codes" (
  "code" text PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" text NOT NULL,
  "expires_at" text NOT NULL,
  "used_at" text,
  -- 'linked' | 'taken' once used.
  "result" text,
  "kick_username" text
);
CREATE INDEX IF NOT EXISTS "kick_link_codes_user_idx" ON "kick_link_codes" USING btree ("user_id");

-- What Kick told us about one Kick user in one channel. followed_at: a channel.followed event (or a
-- code typed in a followers-only chat) — Kick sends no unfollow, so it stands. sub_until: the end of
-- the subscription Kick reported, or ~35 days after a sub badge was seen.
CREATE TABLE IF NOT EXISTS "kick_channel_facts" (
  "broadcaster_id" text NOT NULL,
  "kick_user_id" text NOT NULL,
  "followed_at" text,
  "sub_until" text,
  "updated_at" text NOT NULL,
  CONSTRAINT "kick_channel_facts_pk" PRIMARY KEY ("broadcaster_id", "kick_user_id")
);

-- Which platform account passed a gate into which event, for whom — event_twitch_claims for any
-- platform (Kick now). Same rule: one platform account, one player per event.
CREATE TABLE IF NOT EXISTS "event_gate_claims" (
  "event_id" integer NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,
  "platform" text NOT NULL,
  "platform_user_id" text NOT NULL,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "claimed_at" text NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "event_gate_claims_unique" ON "event_gate_claims" USING btree ("event_id", "platform", "platform_user_id");

-- Kick webhook message ids already handled (Kick-Event-Message-Id), so a replayed or redelivered
-- event is applied once. Pruned after a day.
CREATE TABLE IF NOT EXISTS "kick_webhook_seen" (
  "message_id" text PRIMARY KEY NOT NULL,
  "seen_at" text NOT NULL
);

-- The `!join` bot account's own Kick token (optional; KICK_BOT_REFRESH_TOKEN seeds it). Kick rotates
-- refresh tokens, so the current one lives here, encrypted; seed_hash notices a new env seed.
CREATE TABLE IF NOT EXISTS "kick_bot_tokens" (
  "id" text PRIMARY KEY NOT NULL,
  "seed_hash" text NOT NULL,
  "access_token" text,
  "refresh_token" text NOT NULL,
  "expires_at" text,
  "updated_at" text NOT NULL
);
