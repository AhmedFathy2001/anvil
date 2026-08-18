-- Retire clan_members. The new tables become the source of truth, and the roster becomes a view.
--
-- 0006 and 0007 built players/accounts/clan_memberships alongside clan_members and backfilled them,
-- deliberately leaving clan_members authoritative so readers could move separately. This is the
-- flip. Everything clan_members held now lives on the account or on the seat, and the row shape the
-- app reads is reassembled as `clan_roster`.
--
-- WHY A VIEW AND NOT A WIDE REWRITE
--
-- "The roster of a clan, with each seat's RSN and stat state alongside it" is what most of this
-- codebase actually wants — some 80 files ask for exactly that join. Writing it out by hand in each
-- of them would be the same query 80 times, with 80 chances to forget the clan filter. The view is
-- the read model, not a shim: reads go through it, writes go to the two real tables, and Drizzle
-- refuses at compile time to write through it.
--
-- One column is deliberately NOT carried across: is_guest, replaced by clan_memberships.kind. An
-- inverted flag is one typo away from granting membership, and membership is granted, never
-- assumed — `kind = 'member'` says what it means, `is_guest = 0` says it backwards. Every call site
-- becomes a compile error, which is the point: that is where a silent misread matters most.

-- ── 1) The seat references follow the seat ──────────────────────────────────────────────────
--
-- Fifteen tables carry clan_member_id. The seat is the same seat and kept the same id (0006), so
-- this is a constraint swap with no data change. The column keeps its name for now — renaming it to
-- membership_id is a separate, purely mechanical change, and bundling it here would hide this one.
ALTER TABLE "clan_audit_log" DROP CONSTRAINT "clan_audit_log_clan_member_id_clan_members_id_fk";--> statement-breakpoint
ALTER TABLE "event_signups" DROP CONSTRAINT "event_signups_clan_member_id_clan_members_id_fk";--> statement-breakpoint
ALTER TABLE "member_clog" DROP CONSTRAINT "member_clog_clan_member_id_clan_members_id_fk";--> statement-breakpoint
ALTER TABLE "member_clog_items" DROP CONSTRAINT "member_clog_items_clan_member_id_clan_members_id_fk";--> statement-breakpoint
ALTER TABLE "member_clog_kc" DROP CONSTRAINT "member_clog_kc_clan_member_id_clan_members_id_fk";--> statement-breakpoint
ALTER TABLE "member_daily_stats" DROP CONSTRAINT "member_daily_stats_clan_member_id_clan_members_id_fk";--> statement-breakpoint
ALTER TABLE "member_milestones" DROP CONSTRAINT "member_milestones_clan_member_id_clan_members_id_fk";--> statement-breakpoint
ALTER TABLE "member_personal_bests" DROP CONSTRAINT "member_personal_bests_clan_member_id_clan_members_id_fk";--> statement-breakpoint
ALTER TABLE "payouts" DROP CONSTRAINT "payouts_clan_member_id_clan_members_id_fk";--> statement-breakpoint
ALTER TABLE "pending_renames" DROP CONSTRAINT "pending_renames_clan_member_id_clan_members_id_fk";--> statement-breakpoint
ALTER TABLE "player_event_facts" DROP CONSTRAINT "player_event_facts_clan_member_id_clan_members_id_fk";--> statement-breakpoint
ALTER TABLE "player_snapshots" DROP CONSTRAINT "player_snapshots_clan_member_id_clan_members_id_fk";--> statement-breakpoint
ALTER TABLE "event_participants" DROP CONSTRAINT "players_clan_member_id_clan_members_id_fk";--> statement-breakpoint
ALTER TABLE "weekly_participants" DROP CONSTRAINT "weekly_participants_clan_member_id_clan_members_id_fk";--> statement-breakpoint
ALTER TABLE "moments" DROP CONSTRAINT "moments_clan_member_id_clan_members_id_fk";--> statement-breakpoint

-- A seat that no membership claims would break the new constraints. There should be none — a clan
-- cannot hold one RSN twice — but a migration that silently drops history is not worth the risk, so
-- stop rather than cascade.
DO $$
DECLARE orphans integer;
BEGIN
  SELECT count(*) INTO orphans FROM (
    SELECT "clan_member_id" FROM "clan_audit_log"
    UNION SELECT "clan_member_id" FROM "event_signups"
    UNION SELECT "clan_member_id" FROM "member_clog"
    UNION SELECT "clan_member_id" FROM "member_clog_items"
    UNION SELECT "clan_member_id" FROM "member_clog_kc"
    UNION SELECT "clan_member_id" FROM "member_daily_stats"
    UNION SELECT "clan_member_id" FROM "member_milestones"
    UNION SELECT "clan_member_id" FROM "member_personal_bests"
    UNION SELECT "clan_member_id" FROM "payouts"
    UNION SELECT "clan_member_id" FROM "pending_renames"
    UNION SELECT "clan_member_id" FROM "player_event_facts"
    UNION SELECT "clan_member_id" FROM "player_snapshots"
    UNION SELECT "clan_member_id" FROM "event_participants"
    UNION SELECT "clan_member_id" FROM "weekly_participants"
    UNION SELECT "clan_member_id" FROM "moments"
  ) refs
  WHERE "clan_member_id" IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM "clan_memberships" m WHERE m."id" = refs."clan_member_id");
  IF orphans > 0 THEN
    RAISE EXCEPTION 'aborting: % clan_member_id reference(s) have no membership', orphans;
  END IF;
END $$;--> statement-breakpoint

ALTER TABLE "clan_audit_log" ADD CONSTRAINT "clan_audit_log_clan_member_id_clan_memberships_id_fk" FOREIGN KEY ("clan_member_id") REFERENCES "public"."clan_memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_signups" ADD CONSTRAINT "event_signups_clan_member_id_clan_memberships_id_fk" FOREIGN KEY ("clan_member_id") REFERENCES "public"."clan_memberships"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_clog" ADD CONSTRAINT "member_clog_clan_member_id_clan_memberships_id_fk" FOREIGN KEY ("clan_member_id") REFERENCES "public"."clan_memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_clog_items" ADD CONSTRAINT "member_clog_items_clan_member_id_clan_memberships_id_fk" FOREIGN KEY ("clan_member_id") REFERENCES "public"."clan_memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_clog_kc" ADD CONSTRAINT "member_clog_kc_clan_member_id_clan_memberships_id_fk" FOREIGN KEY ("clan_member_id") REFERENCES "public"."clan_memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_daily_stats" ADD CONSTRAINT "member_daily_stats_clan_member_id_clan_memberships_id_fk" FOREIGN KEY ("clan_member_id") REFERENCES "public"."clan_memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_milestones" ADD CONSTRAINT "member_milestones_clan_member_id_clan_memberships_id_fk" FOREIGN KEY ("clan_member_id") REFERENCES "public"."clan_memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_personal_bests" ADD CONSTRAINT "member_personal_bests_clan_member_id_clan_memberships_id_fk" FOREIGN KEY ("clan_member_id") REFERENCES "public"."clan_memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_clan_member_id_clan_memberships_id_fk" FOREIGN KEY ("clan_member_id") REFERENCES "public"."clan_memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_renames" ADD CONSTRAINT "pending_renames_clan_member_id_clan_memberships_id_fk" FOREIGN KEY ("clan_member_id") REFERENCES "public"."clan_memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_event_facts" ADD CONSTRAINT "player_event_facts_clan_member_id_clan_memberships_id_fk" FOREIGN KEY ("clan_member_id") REFERENCES "public"."clan_memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_snapshots" ADD CONSTRAINT "player_snapshots_clan_member_id_clan_memberships_id_fk" FOREIGN KEY ("clan_member_id") REFERENCES "public"."clan_memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_participants" ADD CONSTRAINT "event_participants_clan_member_id_clan_memberships_id_fk" FOREIGN KEY ("clan_member_id") REFERENCES "public"."clan_memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_participants" ADD CONSTRAINT "weekly_participants_clan_member_id_clan_memberships_id_fk" FOREIGN KEY ("clan_member_id") REFERENCES "public"."clan_memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moments" ADD CONSTRAINT "moments_clan_member_id_clan_memberships_id_fk" FOREIGN KEY ("clan_member_id") REFERENCES "public"."clan_memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- ── 2) The Discord-id cache follows the account ─────────────────────────────────────────────
--
-- Not the same thing as users.discord_id, which is a proven OAuth link. This is the answer to
-- "which Discord user is this RSN?" arrived at by name-matching the guild — the only handle there
-- is on a member who has never signed in. It belongs to the account rather than to the seat: the
-- mapping is global, so matching once in one clan should not mean matching again in the next.
--
-- Prefers a non-null value, and the most recently active seat when several clans cached one.
ALTER TABLE "accounts" ADD COLUMN "discord_id" text;--> statement-breakpoint
UPDATE "accounts" a SET "discord_id" = cached."discord_id"
FROM (
  SELECT DISTINCT ON (cm."rsn_normalized") cm."rsn_normalized", cm."discord_id"
  FROM "clan_members" cm
  WHERE cm."discord_id" IS NOT NULL
  ORDER BY cm."rsn_normalized", cm."last_seen_in_clan" DESC NULLS LAST, cm."id"
) cached
WHERE cached."rsn_normalized" = a."rsn_normalized";--> statement-breakpoint

-- ── 3) The table goes ───────────────────────────────────────────────────────────────────────
DROP TABLE "clan_members";--> statement-breakpoint

-- ── 4) The roster, reassembled ──────────────────────────────────────────────────────────────
--
-- Read-only by construction: no INSTEAD OF triggers, so a write against it fails rather than
-- quietly succeeding into the wrong place. Writes name the table they mean.
CREATE VIEW "clan_roster" AS
SELECT
  m."id"                  AS "id",
  m."clan_id"             AS "clan_id",
  m."account_id"          AS "account_id",
  a."player_id"           AS "player_id",
  a."rsn"                 AS "rsn",
  a."rsn_normalized"      AS "rsn_normalized",
  a."account_hash"        AS "account_hash",
  a."discord_id"          AS "discord_id",
  m."kind"                AS "kind",
  m."rank"                AS "rank",
  m."source"              AS "source",
  m."joined_at"           AS "joined_at",
  m."left_at"             AS "left_at",
  m."last_seen_in_clan"   AS "last_seen_in_clan",
  m."notes"               AS "notes",
  m."pending_role"        AS "pending_role",
  a."previous_rsns"       AS "previous_rsns",
  a."is_primary"          AS "is_primary",
  a."verified_at"         AS "verified_at",
  a."verification_method" AS "verification_method",
  a."verified_by_user_id" AS "verified_by_user_id",
  a."provisional"         AS "provisional",
  a."claimed_at"          AS "claimed_at",
  a."status"              AS "status",
  a."status_last_checked" AS "status_last_checked",
  a."live_stats"          AS "live_stats",
  a."live_stats_at"       AS "live_stats_at",
  a."live_stat_key_times" AS "live_stat_key_times",
  a."stats_overall_xp"    AS "stats_overall_xp",
  a."stats_miss_streak"   AS "stats_miss_streak",
  a."stats_next_due_at"   AS "stats_next_due_at",
  a."stats_last_snapshot" AS "stats_last_snapshot",
  a."stats_activities"    AS "stats_activities"
FROM "clan_memberships" m
JOIN "accounts" a ON a."id" = m."account_id";
