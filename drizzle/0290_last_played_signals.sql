-- Last played beyond the plugin (lib/pluginDropoff): when the hiscores sweep last saw an account's
-- stats move, and when it last saw gains the plugin had not pushed (play away from the plugin).
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "stats_changed_at" text;
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "unseen_play_at" text;
--> statement-breakpoint
-- A starting value from history: the newest day anything moved. member_daily_stats.updated_at is the
-- 'YYYY-MM-DD HH24:MI:SS' UTC form; stored here as ISO like the sweep writes it.
UPDATE "accounts" a SET "stats_changed_at" = replace(d.at, ' ', 'T') || 'Z'
FROM (
  SELECT "account_id", max("updated_at") AS at FROM "member_daily_stats"
  WHERE "xp_gained" > 0 OR "ehb_milli_gained" > 0 OR "deltas" IS NOT NULL
  GROUP BY "account_id"
) d
WHERE d."account_id" = a."id" AND a."stats_changed_at" IS NULL;
