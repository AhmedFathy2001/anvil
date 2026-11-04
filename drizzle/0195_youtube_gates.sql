-- YouTube entry gates (lib/gates/youtube): a creator-space event can be limited to the host's YouTube
-- subscribers, or to their channel members (seen in the host's live chat). Additive only.

-- A creator space's own YouTube channel, connected by its owner (scope youtube.readonly). Its tokens,
-- encrypted with lib/secretBox under YOUTUBE_TOKEN_KEY, read the host's live chat for the member
-- check. The subscriber check runs on the viewer's own (never stored) token instead.
CREATE TABLE IF NOT EXISTS "clan_youtube_channels" (
  "clan_id" integer PRIMARY KEY NOT NULL REFERENCES "clans"("id") ON DELETE CASCADE,
  "youtube_channel_id" text NOT NULL,
  "title" text NOT NULL,
  "handle" text,
  "access_token" text NOT NULL,
  "refresh_token" text NOT NULL,
  "expires_at" text NOT NULL,
  "scope" text NOT NULL,
  "linked_by_user_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
  -- Set when Google refused a refresh: the host has to connect again. Member checks fail closed meanwhile.
  "broken_at" text,
  "updated_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL
);

-- A viewer's linked YouTube channel, proved by a Google sign-in (identity only: the token is revoked
-- at once, never stored). One channel per Anvil login, so one subscription or membership cannot let a
-- crowd of alts through — and the member chat code only counts when typed FROM this channel.
CREATE TABLE IF NOT EXISTS "user_youtube_links" (
  "user_id" integer PRIMARY KEY NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "youtube_channel_id" text NOT NULL,
  "youtube_title" text NOT NULL,
  "linked_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "user_youtube_links_channel_unique" ON "user_youtube_links" USING btree ("youtube_channel_id");

-- A point-in-time YouTube proof for one viewer against one host channel: 'sub' from the viewer's
-- own subscriptions (OAuth, token revoked straight after), 'member' from their chat code in the
-- host's live chat. Trusted for a day (lib/gates/youtubeDb PROOF_TTL_MS), then asked again.
CREATE TABLE IF NOT EXISTS "user_youtube_proofs" (
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "host_channel_id" text NOT NULL,
  "kind" text NOT NULL,
  "youtube_channel_id" text NOT NULL,
  "youtube_title" text NOT NULL,
  "ok" boolean NOT NULL,
  "checked_at" text NOT NULL,
  CONSTRAINT "user_youtube_proofs_pk" PRIMARY KEY ("user_id", "host_channel_id", "kind")
);

-- Event claims (one YouTube channel, one player per event) use event_gate_claims from 0194 with
-- platform = 'youtube' (lib/gates/claims).
