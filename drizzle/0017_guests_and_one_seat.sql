-- Guests arrive by request, and an account is a member of one clan at a time.
--
-- TWO CHANGES THAT BELONG TOGETHER: joining clan B demotes your seat in clan A to guest, and a
-- demoted member is exactly the case the guest machinery has to handle well.

-- ── How a clan admits people it does not already have ────────────────────────────────────────
--
-- 'approval' by default. Membership is granted, never assumed — and the four paths that used to
-- mint a guest seat did so silently, so anyone who logged in once appeared on a roster nobody had
-- agreed to put them on.
ALTER TABLE "clans" ADD COLUMN IF NOT EXISTS "guest_policy" text DEFAULT 'approval' NOT NULL;

CREATE TABLE IF NOT EXISTS "clan_join_requests" (
  "id" serial PRIMARY KEY NOT NULL,
  "clan_id" integer NOT NULL REFERENCES "clans"("id") ON DELETE cascade,
  -- The ACCOUNT being asked about: a person applies with a character, and which one matters — it is
  -- the name the clan will see on its roster.
  "account_id" integer NOT NULL REFERENCES "accounts"("id") ON DELETE cascade,
  -- The person behind it, so a ban (which is per person) can block the request.
  "player_id" integer REFERENCES "players"("id") ON DELETE set null,
  "status" text DEFAULT 'pending' NOT NULL,   -- pending | approved | rejected | withdrawn
  "message" text,
  "source" text DEFAULT 'web' NOT NULL,       -- web | plugin
  "requested_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL,
  "decided_at" text,
  "decided_by_user_id" integer REFERENCES "users"("id") ON DELETE set null,
  "decided_note" text
);

-- One live request per account per clan. Partial, so a rejected one does not block asking again
-- later — people fall out with clans and make up.
CREATE UNIQUE INDEX IF NOT EXISTS "clan_join_requests_pending_unique"
  ON "clan_join_requests" ("clan_id", "account_id") WHERE "status" = 'pending';

CREATE INDEX IF NOT EXISTS "clan_join_requests_clan_status_idx"
  ON "clan_join_requests" ("clan_id", "status");

-- ── One member seat per account ──────────────────────────────────────────────────────────────
--
-- OSRS lets an account be in exactly one clan, so the site should not be able to represent
-- otherwise. Guest seats stay unlimited: guesting is not membership.
--
-- Verified clean on the live data before adding — 410 member seats across 410 distinct accounts,
-- and the only accounts sitting in two clans were each guest+member. That it already held is the
-- tell that it was always true and merely unenforced.
--
-- But "the data I looked at was clean" is not the same as "no data can be dirty". A deployment that
-- imported rosters before this rule existed could hold an account claimed as a member by two clans,
-- and then this index would fail — taking the whole migration, and the deploy, with it. So repair
-- first, by the same rule the app applies from now on: the most recent membership wins, the rest
-- become guests. Nobody is removed and no history is lost.
UPDATE "clan_memberships" m
   SET "kind" = 'guest'
 WHERE m."kind" = 'member'
   AND m."left_at" IS NULL
   AND EXISTS (
     SELECT 1 FROM "clan_memberships" keep
      WHERE keep."account_id" = m."account_id"
        AND keep."kind" = 'member'
        AND keep."left_at" IS NULL
        AND (keep."joined_at", keep."id") > (m."joined_at", m."id")
   );

CREATE UNIQUE INDEX IF NOT EXISTS "clan_memberships_one_member_seat"
  ON "clan_memberships" ("account_id") WHERE "kind" = 'member' AND "left_at" IS NULL;
