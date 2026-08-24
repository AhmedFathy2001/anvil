-- Widen the columns that hold an ABSOLUTE total XP from int4 to int8.
--
-- A maxed OSRS account carries ~4,600,000,000 total XP. int4 tops out at 2,147,483,647, so the
-- driver refuses the value while encoding and the whole write fails — it does not truncate. For the
-- stats sweep that means the account is retried on its next tick and fails identically, forever, on
-- exactly the accounts belonging to a clan's best players.
--
-- Only totals are widened. The gains beside them (xp_gained, ehp_milli, ehb_milli) are deltas with
-- no realistic path to 2.1B and stay as they are.
--
-- int4 -> int8 is a metadata-only change in Postgres for these column widths, so this does not
-- rewrite the tables.

--> statement-breakpoint
-- clan_roster reads accounts.stats_overall_xp, and Postgres will not alter a column a view depends
-- on. Dropped and recreated verbatim around the change.
DROP VIEW IF EXISTS "clan_roster";
--> statement-breakpoint
ALTER TABLE "accounts" ALTER COLUMN "stats_overall_xp" TYPE bigint;
--> statement-breakpoint
ALTER TABLE "player_snapshots" ALTER COLUMN "overall_xp" TYPE bigint;
--> statement-breakpoint
ALTER TABLE "member_daily_stats" ALTER COLUMN "overall_xp" TYPE bigint;
--> statement-breakpoint
CREATE VIEW "clan_roster" AS
SELECT m.id,
   m.clan_id,
   m.account_id,
   a.player_id,
   a.rsn,
   a.rsn_normalized,
   a.account_hash,
   a.discord_id,
   m.kind,
   m.rank,
   m.source,
   m.joined_at,
   m.left_at,
   m.last_seen_in_clan,
   m.notes,
   m.pending_role,
   a.previous_rsns,
   a.is_primary,
   a.verified_at,
   a.verification_method,
   a.verified_by_user_id,
   a.provisional,
   a.claimed_at,
   a.status,
   a.status_last_checked,
   a.live_stats,
   a.live_stats_at,
   a.live_stat_key_times,
   a.stats_overall_xp,
   a.stats_miss_streak,
   a.stats_next_due_at,
   a.stats_last_snapshot,
   a.stats_activities
  FROM clan_memberships m
    JOIN accounts a ON a.id = m.account_id;
