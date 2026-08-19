-- What Jagex tracks belongs to the ACCOUNT, so its history does too.
--
-- These eight tables were keyed to a roster SEAT, which was the same thing while one clan owned the
-- database. It is not the same thing now: a person in two clans holds one account and two seats, so
-- the sweep would write them two daily series, two sets of personal bests, two collection logs — one
-- account, tracked twice, agreeing about nothing.
--
-- Nobody has a split series yet, because the shared accounts only just arrived. That is exactly why
-- this happens now: the first sweep after the cutover would create them, and merging afterwards
-- means reconciling two histories instead of preventing one.
--
-- Each table merges by what its numbers mean. Nothing here is a blanket rule, because there isn't
-- one — a total is not a delta and a personal best is not a maximum.

-- ── 1) Every table gains the account it was always describing ───────────────────────────────
ALTER TABLE "player_snapshots" ADD COLUMN "account_id" integer;--> statement-breakpoint
ALTER TABLE "member_daily_stats" ADD COLUMN "account_id" integer;--> statement-breakpoint
ALTER TABLE "member_milestones" ADD COLUMN "account_id" integer;--> statement-breakpoint
ALTER TABLE "member_personal_bests" ADD COLUMN "account_id" integer;--> statement-breakpoint
ALTER TABLE "member_clog" ADD COLUMN "account_id" integer;--> statement-breakpoint
ALTER TABLE "member_clog_items" ADD COLUMN "account_id" integer;--> statement-breakpoint
ALTER TABLE "member_clog_kc" ADD COLUMN "account_id" integer;--> statement-breakpoint
ALTER TABLE "member_progress" ADD COLUMN "account_id" integer;--> statement-breakpoint

UPDATE "player_snapshots" t SET "account_id" = m."account_id" FROM "clan_memberships" m WHERE m."id" = t."clan_member_id";--> statement-breakpoint
UPDATE "member_daily_stats" t SET "account_id" = m."account_id" FROM "clan_memberships" m WHERE m."id" = t."clan_member_id";--> statement-breakpoint
UPDATE "member_milestones" t SET "account_id" = m."account_id" FROM "clan_memberships" m WHERE m."id" = t."clan_member_id";--> statement-breakpoint
UPDATE "member_personal_bests" t SET "account_id" = m."account_id" FROM "clan_memberships" m WHERE m."id" = t."clan_member_id";--> statement-breakpoint
UPDATE "member_clog" t SET "account_id" = m."account_id" FROM "clan_memberships" m WHERE m."id" = t."clan_member_id";--> statement-breakpoint
UPDATE "member_clog_items" t SET "account_id" = m."account_id" FROM "clan_memberships" m WHERE m."id" = t."clan_member_id";--> statement-breakpoint
UPDATE "member_clog_kc" t SET "account_id" = m."account_id" FROM "clan_memberships" m WHERE m."id" = t."clan_member_id";--> statement-breakpoint
UPDATE "member_progress" t SET "account_id" = m."account_id" FROM "clan_memberships" m WHERE m."id" = t."clan_member_id";--> statement-breakpoint

-- A row whose seat is gone describes an account nothing can name any more.
DELETE FROM "player_snapshots" WHERE "account_id" IS NULL;--> statement-breakpoint
DELETE FROM "member_daily_stats" WHERE "account_id" IS NULL;--> statement-breakpoint
DELETE FROM "member_milestones" WHERE "account_id" IS NULL;--> statement-breakpoint
DELETE FROM "member_personal_bests" WHERE "account_id" IS NULL;--> statement-breakpoint
DELETE FROM "member_clog" WHERE "account_id" IS NULL;--> statement-breakpoint
DELETE FROM "member_clog_items" WHERE "account_id" IS NULL;--> statement-breakpoint
DELETE FROM "member_clog_kc" WHERE "account_id" IS NULL;--> statement-breakpoint
DELETE FROM "member_progress" WHERE "account_id" IS NULL;--> statement-breakpoint

-- ── 2) Merge what two seats recorded about one account ──────────────────────────────────────

-- A day's totals are monotone, so the highest reading is the truest. The gains are what was actually
-- observed, and two clans watching one account saw the same gains twice rather than twice the gains
-- — so the larger stands, not the sum.
UPDATE "member_daily_stats" keep SET
  "overall_xp"        = agg."overall_xp",
  "ehp_milli"         = agg."ehp_milli",
  "ehb_milli"         = agg."ehb_milli",
  "xp_gained"         = agg."xp_gained",
  "ehp_milli_gained"  = agg."ehp_milli_gained",
  "ehb_milli_gained"  = agg."ehb_milli_gained",
  "deltas"            = COALESCE(keep."deltas", agg."deltas")
FROM (
  SELECT "account_id", "day",
         MAX("overall_xp") AS overall_xp, MAX("ehp_milli") AS ehp_milli, MAX("ehb_milli") AS ehb_milli,
         MAX("xp_gained") AS xp_gained, MAX("ehp_milli_gained") AS ehp_milli_gained,
         MAX("ehb_milli_gained") AS ehb_milli_gained,
         MAX("deltas") AS deltas
  FROM "member_daily_stats" GROUP BY "account_id", "day" HAVING count(*) > 1
) agg
WHERE keep."account_id" = agg."account_id" AND keep."day" = agg."day";--> statement-breakpoint

DELETE FROM "member_daily_stats" d USING "member_daily_stats" other
WHERE d."account_id" = other."account_id" AND d."day" = other."day" AND d."id" > other."id";--> statement-breakpoint

-- A milestone is the moment a threshold was first crossed, so the earliest sighting wins: the second
-- clan to notice did not witness a second crossing.
UPDATE "member_milestones" keep SET "noticed_at" = agg."first"
FROM (
  SELECT "account_id", "kind", "metric", "threshold", MIN("noticed_at") AS first
  FROM "member_milestones" GROUP BY 1,2,3,4 HAVING count(*) > 1
) agg
WHERE keep."account_id" = agg."account_id" AND keep."kind" = agg."kind"
  AND keep."metric" = agg."metric" AND keep."threshold" = agg."threshold";--> statement-breakpoint

DELETE FROM "member_milestones" m USING "member_milestones" other
WHERE m."account_id" = other."account_id" AND m."kind" = other."kind" AND m."metric" = other."metric"
  AND m."threshold" = other."threshold" AND m."id" > other."id";--> statement-breakpoint

-- A personal best is the FASTEST run, so the merge takes the least time — the one place where the
-- smaller number is the better one.
UPDATE "member_personal_bests" keep SET "centis" = agg."best", "achieved_at" = agg."when"
FROM (
  SELECT "account_id", "activity", "team_size", MIN("centis") AS best,
         (ARRAY_AGG("achieved_at" ORDER BY "centis"))[1] AS when
  FROM "member_personal_bests" GROUP BY 1,2,3 HAVING count(*) > 1
) agg
WHERE keep."account_id" = agg."account_id" AND keep."activity" = agg."activity"
  AND keep."team_size" IS NOT DISTINCT FROM agg."team_size";--> statement-breakpoint

DELETE FROM "member_personal_bests" p USING "member_personal_bests" other
WHERE p."account_id" = other."account_id" AND p."activity" = other."activity"
  AND p."team_size" IS NOT DISTINCT FROM other."team_size" AND p."id" > other."id";--> statement-breakpoint

-- The collection log is the account's, so the fuller sync wins outright rather than being blended.
DELETE FROM "member_clog" c USING "member_clog" other
WHERE c."account_id" = other."account_id"
  AND (c."obtained", c."clan_member_id") < (other."obtained", other."clan_member_id");--> statement-breakpoint

-- An unlock happened once; the earliest sighting is when.
UPDATE "member_clog_items" keep SET "first_seen_at" = agg."first"
FROM (
  SELECT "account_id", "item_id", MIN("first_seen_at") AS first
  FROM "member_clog_items" GROUP BY 1,2 HAVING count(*) > 1
) agg
WHERE keep."account_id" = agg."account_id" AND keep."item_id" = agg."item_id";--> statement-breakpoint

DELETE FROM "member_clog_items" i USING "member_clog_items" other
WHERE i."account_id" = other."account_id" AND i."item_id" = other."item_id" AND i."id" > other."id";--> statement-breakpoint

DELETE FROM "member_clog_kc" k USING "member_clog_kc" other
WHERE k."account_id" = other."account_id" AND k."page_name" = other."page_name"
  AND k."label" = other."label" AND k."count" <= other."count" AND k."id" <> other."id";--> statement-breakpoint

-- Progress values only rise, so the highest is current.
UPDATE "member_progress" keep SET "value" = agg."best"
FROM (SELECT "account_id", "key", MAX("value") AS best FROM "member_progress" GROUP BY 1,2 HAVING count(*) > 1) agg
WHERE keep."account_id" = agg."account_id" AND keep."key" = agg."key";--> statement-breakpoint

DELETE FROM "member_progress" p USING "member_progress" other
WHERE p."account_id" = other."account_id" AND p."key" = other."key" AND p."id" > other."id";--> statement-breakpoint

-- player_snapshots is deliberately NOT deduped.
--
-- The obvious "defensive" pass here treated two NULL competition ids as equal and deleted 120
-- accounts' worth of rows on the real data. They were not duplicates: a snapshot with no competition
-- is a standalone observation, an account has a series of them, and Postgres allows that because
-- NULLs are distinct in a unique index — which is exactly why the original index permitted it too.
-- A snapshot that DOES name a competition cannot collide anyway, since a competition belongs to one
-- clan. So there is nothing to merge, and merging would have quietly cost real history.

-- ── 3) The account becomes the key ──────────────────────────────────────────────────────────
DROP INDEX IF EXISTS "player_snapshots_member_comp_kind_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "member_daily_stats_member_day_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "member_milestones_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "member_pb_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "member_clog_items_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "member_clog_kc_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "member_progress_member_key_unique";--> statement-breakpoint

ALTER TABLE "player_snapshots" DROP COLUMN "clan_member_id";--> statement-breakpoint
ALTER TABLE "member_daily_stats" DROP COLUMN "clan_member_id";--> statement-breakpoint
ALTER TABLE "member_milestones" DROP COLUMN "clan_member_id";--> statement-breakpoint
ALTER TABLE "member_personal_bests" DROP COLUMN "clan_member_id";--> statement-breakpoint
ALTER TABLE "member_clog_items" DROP COLUMN "clan_member_id";--> statement-breakpoint
ALTER TABLE "member_clog_kc" DROP COLUMN "clan_member_id";--> statement-breakpoint
ALTER TABLE "member_progress" DROP COLUMN "clan_member_id";--> statement-breakpoint

-- member_clog was keyed BY the seat, so the primary key moves with it.
ALTER TABLE "member_clog" DROP CONSTRAINT "member_clog_pkey";--> statement-breakpoint
ALTER TABLE "member_clog" DROP COLUMN "clan_member_id";--> statement-breakpoint
ALTER TABLE "member_clog" ADD PRIMARY KEY ("account_id");--> statement-breakpoint

ALTER TABLE "player_snapshots" ALTER COLUMN "account_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "member_daily_stats" ALTER COLUMN "account_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "member_milestones" ALTER COLUMN "account_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "member_personal_bests" ALTER COLUMN "account_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "member_clog_items" ALTER COLUMN "account_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "member_clog_kc" ALTER COLUMN "account_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "member_progress" ALTER COLUMN "account_id" SET NOT NULL;--> statement-breakpoint

ALTER TABLE "player_snapshots" ADD CONSTRAINT "player_snapshots_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_daily_stats" ADD CONSTRAINT "member_daily_stats_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_milestones" ADD CONSTRAINT "member_milestones_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_personal_bests" ADD CONSTRAINT "member_personal_bests_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_clog" ADD CONSTRAINT "member_clog_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_clog_items" ADD CONSTRAINT "member_clog_items_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_clog_kc" ADD CONSTRAINT "member_clog_kc_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_progress" ADD CONSTRAINT "member_progress_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

CREATE UNIQUE INDEX "player_snapshots_account_comp_kind_idx" ON "player_snapshots" USING btree ("account_id","weekly_competition_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "member_daily_stats_account_day_idx" ON "member_daily_stats" USING btree ("account_id","day");--> statement-breakpoint
CREATE UNIQUE INDEX "member_milestones_unique" ON "member_milestones" USING btree ("account_id","kind","metric","threshold");--> statement-breakpoint
CREATE UNIQUE INDEX "member_pb_unique" ON "member_personal_bests" USING btree ("account_id","activity","team_size");--> statement-breakpoint
CREATE UNIQUE INDEX "member_clog_items_unique" ON "member_clog_items" USING btree ("account_id","item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "member_clog_kc_unique" ON "member_clog_kc" USING btree ("account_id","page_name","label");--> statement-breakpoint
CREATE UNIQUE INDEX "member_progress_account_key_unique" ON "member_progress" USING btree ("account_id","key");
