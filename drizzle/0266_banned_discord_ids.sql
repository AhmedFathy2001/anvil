-- Bans that outlive a deleted account.
--
-- Deleting an account used to keep a ban enforceable by leaving a "stand-in": a blank `users` row
-- holding only the Discord id and the ban flags, on an empty `players` row, with the live
-- `clan_bans` rows moved to it and their reason cleared. It showed up as a nameless user in staff
-- lists. This table replaces it. It holds a Discord id, which ban it is, when, and (for a clan ban)
-- the clan's own reason; nothing else about the person.
--
--   scope 'platform'  that Discord account cannot sign in (clan_id NULL)
--   scope 'clan'      on that account's next sign-in the ban is put back as an ordinary clan_bans
--                     row on the new person, and this row is deleted
--
-- Numbered 0266 (0265 is the Discord link source).
CREATE TABLE IF NOT EXISTS "banned_discord_ids" (
	"id" serial PRIMARY KEY NOT NULL,
	"discord_id" text NOT NULL,
	"scope" text NOT NULL,
	"clan_id" integer,
	"reason" text,
	"banned_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL,
	"banned_by_user_id" integer,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL,
	CONSTRAINT "banned_discord_ids_clan_id_clans_id_fk" FOREIGN KEY ("clan_id") REFERENCES "public"."clans"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "banned_discord_ids_banned_by_user_id_users_id_fk" FOREIGN KEY ("banned_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action,
	CONSTRAINT "banned_discord_ids_scope_check" CHECK (("scope" = 'platform' AND "clan_id" IS NULL) OR ("scope" = 'clan' AND "clan_id" IS NOT NULL))
);
--> statement-breakpoint
-- One row per (discord_id, scope, clan_id). Two partial indexes because clan_id is NULL for a
-- platform ban and a plain unique index treats NULLs as different.
CREATE UNIQUE INDEX IF NOT EXISTS "banned_discord_ids_platform_unique" ON "banned_discord_ids" USING btree ("discord_id") WHERE "scope" = 'platform';
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "banned_discord_ids_clan_unique" ON "banned_discord_ids" USING btree ("discord_id","clan_id") WHERE "scope" = 'clan';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "banned_discord_ids_clan_idx" ON "banned_discord_ids" USING btree ("clan_id");
--> statement-breakpoint
-- EXISTING STAND-INS, if any. Account deletion has not shipped to production, so there should be
-- none and this block then does nothing. A stand-in is recognised by everything erasePerson left on
-- it and nothing else: a login with a Discord id, an empty display name, no Discord username, no
-- email, no plugin token and no staff role, the only login of a person with no name and no characters, with a
-- ban on the login, on the person, or a live clan ban. Its bans move here (a clan ban's reason was
-- already cleared, so it arrives without one), then the blank login and person are deleted.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT u.id AS user_id, u.discord_id, u.player_id,
           u.banned AS user_banned, u.banned_at AS user_banned_at,
           p.banned AS player_banned, p.banned_at AS player_banned_at
    FROM users u
    JOIN players p ON p.id = u.player_id
    WHERE u.discord_id IS NOT NULL
      AND u.display_name = ''
      AND u.discord_username IS NULL
      AND u.email IS NULL
      AND u.plugin_token_hash IS NULL
      AND u.platform_role = 'none'
      AND p.display_name IS NULL
      AND NOT EXISTS (SELECT 1 FROM accounts a WHERE a.player_id = p.id)
      AND NOT EXISTS (SELECT 1 FROM users o WHERE o.player_id = p.id AND o.id <> u.id)
      AND NOT EXISTS (SELECT 1 FROM clan_staff s WHERE s.user_id = u.id)
      AND (u.banned OR p.banned OR EXISTS (SELECT 1 FROM clan_bans b WHERE b.player_id = p.id AND b.lifted_at IS NULL))
  LOOP
    IF r.user_banned OR r.player_banned THEN
      INSERT INTO banned_discord_ids (discord_id, scope, clan_id, banned_at)
      VALUES (r.discord_id, 'platform', NULL,
              COALESCE(CASE WHEN r.player_banned THEN r.player_banned_at END, r.user_banned_at, to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')))
      ON CONFLICT DO NOTHING;
    END IF;
    INSERT INTO banned_discord_ids (discord_id, scope, clan_id, reason, banned_at, banned_by_user_id)
    SELECT r.discord_id, 'clan', b.clan_id, b.reason, b.banned_at, b.banned_by_user_id
    FROM clan_bans b
    WHERE b.player_id = r.player_id AND b.lifted_at IS NULL
    ON CONFLICT DO NOTHING;
    DELETE FROM users WHERE id = r.user_id;
    -- clan_bans.player_id cascades: the moved bans leave with the blank person.
    DELETE FROM players WHERE id = r.player_id;
  END LOOP;
END $$;
