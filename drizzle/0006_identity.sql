-- Identity: person, account, membership.
--
-- HAND-WRITTEN. drizzle-kit cannot generate this: it sees `players` disappearing and a different
-- `players` appearing and asks, interactively, whether that is a rename — then proposes renaming
-- unrelated columns (pvp_kills -> display_name) to reconcile the two shapes. The transformation
-- below is a data migration, not a schema diff.
--
-- WHAT CHANGES
--
--   players            was one row per person per EVENT — an enrollment, misnamed. Becomes
--                      event_participants, which is what it has always held.
--   players (new)      the PERSON. One row per human.
--   accounts           one row per OSRS account, GLOBALLY. This is where rsn_normalized and
--                      account_hash uniqueness finally means what it says: on clan_members those
--                      constraints were global only by accident of one-clan-per-database, and had
--                      to weaken to (clan, rsn) once clans shared a database.
--   clan_memberships   an account's place on a clan's roster.
--
-- clan_members STAYS for now, and stays the source of truth. ~119 call sites still read it; the new
-- tables are backfilled alongside so readers can move over in a following change, and clan_members
-- is dropped only once nothing reads it. Adding the structure and switching every reader in one
-- migration would be unreviewable and unrollbackable.

-- ── 1) The misnamed table gets its real name ────────────────────────────────────────────────
ALTER TABLE "players" RENAME TO "event_participants";--> statement-breakpoint

-- ── 2) The person ───────────────────────────────────────────────────────────────────────────
CREATE TABLE "players" (
	"id" serial PRIMARY KEY NOT NULL,
	"display_name" text,
	"banned" boolean DEFAULT false NOT NULL,
	"banned_at" text,
	"banned_reason" text,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL
);--> statement-breakpoint

-- ── 3) The account ──────────────────────────────────────────────────────────────────────────
CREATE TABLE "accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_id" integer,
	"rsn" text NOT NULL,
	"rsn_normalized" text NOT NULL,
	"account_hash" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL
);--> statement-breakpoint

-- ── 4) The roster row ───────────────────────────────────────────────────────────────────────
CREATE TABLE "clan_memberships" (
	"id" serial PRIMARY KEY NOT NULL,
	"clan_id" integer NOT NULL,
	"account_id" integer NOT NULL,
	"kind" text DEFAULT 'guest' NOT NULL,
	"rank" text,
	"source" text DEFAULT 'roster' NOT NULL,
	"joined_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL,
	"left_at" text
);--> statement-breakpoint

-- ── 5) Backfill: one person per human ───────────────────────────────────────────────────────
--
-- People who logged in are identified by their user row, so every clan_members row sharing a user_id
-- collapses to ONE person — which is exactly the cross-clan link that did not exist before, and the
-- reason someone in two clans was previously two unrelated rows.
INSERT INTO "players" ("id", "display_name", "banned", "banned_at", "banned_reason")
OVERRIDING SYSTEM VALUE
SELECT
  u."id",
  COALESCE(u."display_name", u."discord_username"),
  u."banned",
  u."banned_at",
  u."banned_reason"
FROM "users" u;--> statement-breakpoint

-- Keep the sequence ahead of the ids we just forced in, or the next insert collides.
--
-- pg_get_serial_sequence rather than a literal name: renaming the old `players` table left ITS
-- sequence called players_id_seq, so this table's serial was auto-named players_id_seq1. Setting the
-- literal bumped the wrong sequence and the next insert collided on ids 1 and 2 — which is exactly
-- what the two-clan fixture caught.
SELECT setval(
  pg_get_serial_sequence('players', 'id'),
  GREATEST((SELECT COALESCE(MAX("id"), 0) FROM "players"), 1)
);--> statement-breakpoint

-- ── 6) Backfill: one account per RSN, globally ──────────────────────────────────────────────
--
-- DISTINCT ON collapses the same RSN appearing on several clans' rosters into ONE account. That
-- merge is the whole point: it is what makes "this person plays in three clans" expressible.
-- Ownership prefers a claimed row (user_id set), so an account claimed in one clan and unclaimed in
-- another lands on the real person rather than on a stranger.
INSERT INTO "accounts" ("player_id", "rsn", "rsn_normalized", "account_hash", "status")
SELECT DISTINCT ON (cm."rsn_normalized")
  cm."user_id",
  cm."rsn",
  cm."rsn_normalized",
  cm."account_hash",
  cm."status"
FROM "clan_members" cm
ORDER BY cm."rsn_normalized", (cm."user_id" IS NULL), cm."id";--> statement-breakpoint

-- Accounts nobody has claimed are people too — they simply have no login yet. One person each, so
-- every account has an owner from the moment it is seen; claiming later merges people rather than
-- inventing one.
--
-- Driven off ACCOUNTS, not off roster rows. Doing it per roster row minted a person for every
-- unclaimed row, including rows for an RSN that is claimed on some OTHER clan's roster — those
-- people then ended up owning nothing, as ghosts in the directory. And a loop rather than
-- INSERT ... SELECT because the account each new person belongs to has to be known exactly:
-- pairing them afterwards by display_name = rsn breaks the moment two clans spell an RSN with
-- different capitalisation.
DO $$
DECLARE
  acct RECORD;
  new_player_id integer;
BEGIN
  FOR acct IN SELECT "id", "rsn" FROM "accounts" WHERE "player_id" IS NULL ORDER BY "id" LOOP
    INSERT INTO "players" ("display_name") VALUES (acct."rsn") RETURNING "id" INTO new_player_id;
    UPDATE "accounts" SET "player_id" = new_player_id WHERE "id" = acct."id";
  END LOOP;
END $$;--> statement-breakpoint

ALTER TABLE "accounts" ALTER COLUMN "player_id" SET NOT NULL;--> statement-breakpoint

-- ── 7) Backfill: one membership per roster row ──────────────────────────────────────────────
--
-- kind carries the rule the codebase already followed with a flag: every non-roster path wrote
-- is_guest = 1, and only the in-game roster sync promoted to 0. Membership is GRANTED — logging in
-- has never made anyone a member, and must not start now.
INSERT INTO "clan_memberships" ("clan_id", "account_id", "kind", "rank", "source", "joined_at", "left_at")
SELECT
  cm."clan_id",
  a."id",
  CASE WHEN cm."is_guest" = 0 THEN 'member' ELSE 'guest' END,
  cm."rank",
  CASE
    WHEN cm."source" IN ('plugin-roster') THEN 'roster'
    WHEN cm."source" IN ('manual') THEN 'admin'
    ELSE 'application'
  END,
  cm."joined_at",
  cm."left_at"
FROM "clan_members" cm
JOIN "accounts" a ON a."rsn_normalized" = cm."rsn_normalized"
ON CONFLICT DO NOTHING;--> statement-breakpoint

-- ── 8) Constraints, after the data is in ────────────────────────────────────────────────────
CREATE UNIQUE INDEX "accounts_rsn_normalized_unique" ON "accounts" USING btree ("rsn_normalized");--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_account_hash_unique" ON "accounts" USING btree ("account_hash");--> statement-breakpoint
CREATE INDEX "accounts_player_idx" ON "accounts" USING btree ("player_id");--> statement-breakpoint
CREATE UNIQUE INDEX "clan_memberships_clan_account_unique" ON "clan_memberships" USING btree ("clan_id","account_id");--> statement-breakpoint
CREATE INDEX "clan_memberships_clan_kind_idx" ON "clan_memberships" USING btree ("clan_id","kind");--> statement-breakpoint
CREATE INDEX "clan_memberships_account_idx" ON "clan_memberships" USING btree ("account_id");--> statement-breakpoint

ALTER TABLE "accounts" ADD CONSTRAINT "accounts_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_memberships" ADD CONSTRAINT "clan_memberships_clan_id_clans_id_fk" FOREIGN KEY ("clan_id") REFERENCES "public"."clans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_memberships" ADD CONSTRAINT "clan_memberships_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;
