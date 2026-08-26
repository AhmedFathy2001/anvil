-- Where a person's drops, pets, deaths and CAs are announced, once one account can play in several
-- clans at once.
--
-- The plugin posts one notification to the clan whose site it is pointed at, and the server has,
-- until now, forwarded it to exactly that clan. That was right when a person had one clan; it is
-- wrong the moment they guest in a second, because the announcement is about the PERSON, not the
-- address their client happens to hold. Routing moves server-side (lib/emissionRouting), and these
-- two tables are the only state it needs beyond the seats and the `shared` flag that already exist.

-- The per-(account, clan) SOCIAL-emission switch.
--
-- Absence is the common case and means "the default for this relationship": a member clan is on, a
-- guest clan is on only if the account is `shared`. A row overrides that for one clan — `enabled`
-- false silences it, true is an explicit opt-in. The shared gate on GUEST clans is not overridable
-- to true here on purpose: an unshared account announcing to a clan it only guests in would leak the
-- very thing `shared` exists to withhold, so the routing keeps that gate closed regardless. Evidence
-- (a drop that completes a tile) never consults this — it always reaches the event's clan.
CREATE TABLE IF NOT EXISTS "account_clan_emission" (
  "id" serial PRIMARY KEY,
  "account_id" integer NOT NULL REFERENCES "accounts"("id") ON DELETE CASCADE,
  "clan_id" integer NOT NULL REFERENCES "clans"("id") ON DELETE CASCADE,
  "enabled" boolean NOT NULL,
  "updated_at" text DEFAULT (to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')) NOT NULL
);
--> statement-breakpoint
-- One switch per (account, clan): the toggle is a property of the relationship, not a log of it.
CREATE UNIQUE INDEX IF NOT EXISTS "account_clan_emission_unique" ON "account_clan_emission" ("account_id", "clan_id");

--> statement-breakpoint
-- A person's OWN Discord destinations, independent of every clan.
--
-- These belong to the human, not to any roster, so they key on the login (`user_id`) and survive
-- moving between clans, leaving one, joining another. `kinds` is a JSON array of channel keys the
-- destination wants (`["rareDrops","deaths"]`); `min_rarity` is an optional gp floor for the
-- drop-shaped kinds so a personal channel can ask for "only the big ones" without a clan's opinion
-- entering into it. Managed from /profile.
CREATE TABLE IF NOT EXISTS "user_webhooks" (
  "id" serial PRIMARY KEY,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "url" text NOT NULL,
  "label" text,
  "kinds" text DEFAULT '[]' NOT NULL,
  "min_rarity" integer,
  "created_at" text DEFAULT (to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_webhooks_user_idx" ON "user_webhooks" ("user_id");
