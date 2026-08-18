-- Move the columns that describe an OSRS ACCOUNT off the clan seat and onto the account.
--
-- HAND-WRITTEN: every column here has a merge rule, because the same account can sit on several
-- clans' rosters and each roster kept its own copy. Which copy survives is a per-column judgement
-- that a schema diff cannot make.
--
-- The prize is the hiscores sweep. Poll budget is scarce, and today a person in three clans is
-- polled three times for the same account and stored three times. One row per account makes the
-- sweep poll once, and makes a rename or a ban visible everywhere at once instead of in whichever
-- clan happened to notice first.
--
-- clan_members keeps its columns through this migration. Readers move over separately, and it is
-- dropped only when nothing reads it.

-- ── Account-owned: identity ─────────────────────────────────────────────────────────────────
ALTER TABLE "accounts" ADD COLUMN "previous_rsns" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "is_primary" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "verified_at" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "verification_method" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "verified_by_user_id" integer;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "provisional" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "claimed_at" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "status_last_checked" text;--> statement-breakpoint

-- ── Account-owned: hiscores state ───────────────────────────────────────────────────────────
ALTER TABLE "accounts" ADD COLUMN "live_stats" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "live_stats_at" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "live_stat_key_times" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "stats_overall_xp" integer;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "stats_miss_streak" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "stats_next_due_at" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "stats_last_snapshot" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "stats_activities" text;--> statement-breakpoint

ALTER TABLE "accounts" ADD CONSTRAINT "accounts_verified_by_user_id_users_id_fk" FOREIGN KEY ("verified_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

-- ── Seat-owned: things that are true of this roster seat and no other ───────────────────────
ALTER TABLE "clan_memberships" ADD COLUMN "last_seen_in_clan" text;--> statement-breakpoint
ALTER TABLE "clan_memberships" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "clan_memberships" ADD COLUMN "pending_role" text;--> statement-breakpoint

-- ── The person behind a login, made explicit ────────────────────────────────────────────────
--
-- players ids were seeded FROM users ids, so the link is already true — but true by coincidence of
-- numbering, which nothing enforces and no reader can see. Spell it out.
ALTER TABLE "users" ADD COLUMN "player_id" integer;--> statement-breakpoint
UPDATE "users" SET "player_id" = "id";--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "users_player_idx" ON "users" USING btree ("player_id");--> statement-breakpoint

-- ── Backfill: numeric state, merged by what each number means ───────────────────────────────
--
-- overall_xp is monotone, so the highest any clan saw is the truest. miss_streak and next_due_at
-- take the MINIMUM: a successful poll in one clan proves the account is reachable, so the account
-- should not inherit another clan's backoff. verified_at and claimed_at take the earliest — proof
-- of ownership does not expire and does not need re-proving per clan. provisional takes the
-- minimum, because a mod confirming the claim anywhere confirms the account, not the seat.
UPDATE "accounts" a SET
  "stats_overall_xp"    = agg."overall_xp",
  "stats_miss_streak"   = COALESCE(agg."miss_streak", 0),
  "stats_next_due_at"   = agg."next_due_at",
  "status_last_checked" = agg."status_last_checked",
  "verified_at"         = agg."verified_at",
  "claimed_at"          = agg."claimed_at",
  "provisional"         = COALESCE(agg."provisional", 0),
  "is_primary"          = COALESCE(agg."is_primary", 0)
FROM (
  SELECT
    cm."rsn_normalized"                    AS rsn_normalized,
    MAX(cm."stats_overall_xp")             AS overall_xp,
    MIN(cm."stats_miss_streak")            AS miss_streak,
    MIN(cm."stats_next_due_at")            AS next_due_at,
    MAX(cm."status_last_checked")          AS status_last_checked,
    MIN(cm."verified_at")                  AS verified_at,
    MIN(cm."claimed_at")                   AS claimed_at,
    MIN(cm."provisional")                  AS provisional,
    MAX(cm."is_primary")                   AS is_primary
  FROM "clan_members" cm
  GROUP BY cm."rsn_normalized"
) agg
WHERE agg."rsn_normalized" = a."rsn_normalized";--> statement-breakpoint

-- ── Backfill: the stat blobs travel together, from ONE row ──────────────────────────────────
--
-- live_stats, live_stat_key_times, stats_last_snapshot and stats_activities are one consistent
-- observation of an account at a moment. Merging them column-by-column would splice two different
-- moments into a reading that never happened, so the freshest row wins as a whole.
UPDATE "accounts" a SET
  "live_stats"          = fresh."live_stats",
  "live_stats_at"       = fresh."live_stats_at",
  "live_stat_key_times" = fresh."live_stat_key_times",
  "stats_last_snapshot" = fresh."stats_last_snapshot",
  "stats_activities"    = fresh."stats_activities"
FROM (
  SELECT DISTINCT ON (cm."rsn_normalized")
    cm."rsn_normalized", cm."live_stats", cm."live_stats_at", cm."live_stat_key_times",
    cm."stats_last_snapshot", cm."stats_activities"
  FROM "clan_members" cm
  ORDER BY cm."rsn_normalized", cm."live_stats_at" DESC NULLS LAST, cm."id"
) fresh
WHERE fresh."rsn_normalized" = a."rsn_normalized";--> statement-breakpoint

-- Name history: whichever clan tracked the most of it. These are append-only JSON arrays of past
-- RSNs, so the longest is the most complete rather than merely the most recent.
UPDATE "accounts" a SET "previous_rsns" = longest."previous_rsns"
FROM (
  SELECT DISTINCT ON (cm."rsn_normalized") cm."rsn_normalized", cm."previous_rsns"
  FROM "clan_members" cm
  WHERE cm."previous_rsns" IS NOT NULL
  ORDER BY cm."rsn_normalized", length(cm."previous_rsns") DESC, cm."id"
) longest
WHERE longest."rsn_normalized" = a."rsn_normalized";--> statement-breakpoint

-- How the account was verified, taken from the row that verified it first — so the method matches
-- the verified_at chosen above rather than being picked independently.
UPDATE "accounts" a SET
  "verification_method" = first_proof."verification_method",
  "verified_by_user_id" = first_proof."verified_by_user_id"
FROM (
  SELECT DISTINCT ON (cm."rsn_normalized")
    cm."rsn_normalized", cm."verification_method", cm."verified_by_user_id"
  FROM "clan_members" cm
  WHERE cm."verified_at" IS NOT NULL
  ORDER BY cm."rsn_normalized", cm."verified_at", cm."id"
) first_proof
WHERE first_proof."rsn_normalized" = a."rsn_normalized";--> statement-breakpoint

-- ── Backfill: seat-owned columns, straight across (the seat kept its id) ────────────────────
UPDATE "clan_memberships" m SET
  "last_seen_in_clan" = cm."last_seen_in_clan",
  "notes"             = cm."notes",
  "pending_role"      = cm."pending_role"
FROM "clan_members" cm
WHERE cm."id" = m."id";--> statement-breakpoint

-- The sweep's work queue: "which accounts are due". Mirrors the index clan_members carries for the
-- same query, which is the one the stats cron runs every 15 minutes.
CREATE INDEX "accounts_due_idx" ON "accounts" USING btree ("status","stats_next_due_at");
