-- Display case: kill-count and personal-best pins (kind 'kc' | 'pb'). stat_key names the stat —
-- a hiscores boss key for 'kc', "<team size>:<activity>" for 'pb'; item_id is 0 for both. Existing
-- 'clog' / 'drop' rows keep a null stat_key and are untouched.
ALTER TABLE "display_case_items" ADD COLUMN IF NOT EXISTS "stat_key" text;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "display_case_items_stat_unique" ON "display_case_items" ("user_id", "kind", "account_id", "stat_key") WHERE "kind" IN ('kc', 'pb');
