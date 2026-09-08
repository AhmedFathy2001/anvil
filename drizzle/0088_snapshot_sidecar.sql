-- THE SNAPSHOT OUT OF THE ROW THE SWEEP REWRITES.
--
-- `stats_last_snapshot` is ~1.6 KB of hiscores JSON and was three quarters of the `accounts` row.
-- The sweep updates that row every time it polls somebody — miss streak and next-due stamp move
-- whether or not the member gained anything — and Postgres rewrites the whole tuple for any update,
-- so a blob almost nothing reads was copied on every poll of every account. 0087 stopped the index
-- churn; this stops the heap churn, and together they make the ordinary "nothing changed" poll a
-- HOT update of a small row.
--
-- The `clan_roster` view keeps exposing `stats_last_snapshot`, so every reader that goes through the
-- roster is untouched. Only the two that read an account directly (lib/clogRead, lib/memberProfile)
-- had to learn where it lives now.
CREATE TABLE IF NOT EXISTS "account_stat_snapshots" (
  "account_id" integer PRIMARY KEY REFERENCES "accounts"("id") ON DELETE CASCADE,
  "snapshot" text
);--> statement-breakpoint
INSERT INTO "account_stat_snapshots" ("account_id", "snapshot")
  SELECT "id", "stats_last_snapshot" FROM "accounts" WHERE "stats_last_snapshot" IS NOT NULL
  ON CONFLICT ("account_id") DO NOTHING;--> statement-breakpoint
-- The view reads the column, and Postgres will not drop one a view depends on.
DROP VIEW IF EXISTS "clan_roster";--> statement-breakpoint
ALTER TABLE "accounts" DROP COLUMN IF EXISTS "stats_last_snapshot";--> statement-breakpoint
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
   s.snapshot AS stats_last_snapshot,
   a.stats_activities
  FROM clan_memberships m
    JOIN accounts a ON a.id = m.account_id
    LEFT JOIN account_stat_snapshots s ON s.account_id = a.id;
