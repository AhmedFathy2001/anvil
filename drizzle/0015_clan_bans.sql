-- A clan barring someone from ITSELF, which is not the same act as barring them from the platform.
--
-- It was one flag. `users.banned` is read by verifyUser, which returns null on it — so a clan
-- moderator pressing "ban" removed that person from EVERY clan on the deployment and from the
-- platform itself. Fine when a clan owned its whole database; a privilege escalation now.
--
-- Keyed on the PERSON, not the account: someone barred from a clan should not walk back in on an
-- alt. account_id records which account occasioned it and is not what the check reads.

CREATE TABLE IF NOT EXISTS "clan_bans" (
  "id" serial PRIMARY KEY NOT NULL,
  "clan_id" integer NOT NULL REFERENCES "clans"("id") ON DELETE cascade,
  "player_id" integer NOT NULL REFERENCES "players"("id") ON DELETE cascade,
  "account_id" integer REFERENCES "accounts"("id") ON DELETE set null,
  "reason" text,
  "banned_by_user_id" integer REFERENCES "users"("id") ON DELETE set null,
  "banned_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL,
  -- Lifted rather than deleted, so "we un-banned them in March" stays answerable.
  "lifted_at" text,
  "lifted_by_user_id" integer REFERENCES "users"("id") ON DELETE set null
);

-- One LIVE ban per person per clan. Partial, so lifting one does not block banning them again later.
CREATE UNIQUE INDEX IF NOT EXISTS "clan_bans_live_unique"
  ON "clan_bans" ("clan_id", "player_id") WHERE "lifted_at" IS NULL;

CREATE INDEX IF NOT EXISTS "clan_bans_clan_idx" ON "clan_bans" ("clan_id");
