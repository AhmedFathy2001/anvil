-- Creator entry gates (lib/entryGates): a creator-space event can be limited to the host's Twitch
-- followers or subscribers, or to people with a role in (or boosting) the host's Discord server.
--
-- events.entry_gates — JSON `{"anyOf":[...]}`, null = anyone. Text, parsed and re-sanitized on every
-- read (lib/entryGates parseGates), so a hand-edited row cannot carry anything the checker does not
-- understand.
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "entry_gates" text;

-- A viewer's linked Twitch account. Identity only: the viewer's token is used once to learn who
-- they are, revoked, and never stored. One Twitch account per Anvil login, so one subscription
-- cannot let a crowd of alts through.
CREATE TABLE IF NOT EXISTS "user_twitch_links" (
  "user_id" integer PRIMARY KEY NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "twitch_user_id" text NOT NULL,
  "twitch_login" text NOT NULL,
  "linked_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "user_twitch_links_twitch_user_unique" ON "user_twitch_links" USING btree ("twitch_user_id");

-- A creator space's own Twitch channel, linked by the broadcaster. Its tokens (encrypted with
-- lib/secretBox under TWITCH_TOKEN_KEY) are what the follower and subscriber checks run on.
CREATE TABLE IF NOT EXISTS "clan_twitch_channels" (
  "clan_id" integer PRIMARY KEY NOT NULL REFERENCES "clans"("id") ON DELETE CASCADE,
  "twitch_user_id" text NOT NULL,
  "twitch_login" text NOT NULL,
  "access_token" text NOT NULL,
  "refresh_token" text NOT NULL,
  "expires_at" text NOT NULL,
  "scope" text NOT NULL,
  -- Twitch broadcaster_type: 'affiliate' | 'partner' | ''. Only affiliates and partners have subs.
  "broadcaster_type" text DEFAULT '' NOT NULL,
  "linked_by_user_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
  -- Set when Twitch refused a refresh: the host has to connect again. Checks fail closed meanwhile.
  "broken_at" text,
  "updated_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL
);
