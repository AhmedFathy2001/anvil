-- member_milestones dedupe for the account-wide kinds. The unique index left NULLs distinct, so the
-- 'totalxp' / 'ehp' / 'ehb' rows (metric NULL) never conflicted and the same step could be inserted
-- (and announced) again. Drop the duplicates, keeping the earliest, then rebuild the index with
-- NULLS NOT DISTINCT (Postgres 15+).
DELETE FROM "member_milestones" m
USING "member_milestones" d
WHERE m."account_id" = d."account_id"
  AND m."kind" = d."kind"
  AND m."metric" IS NOT DISTINCT FROM d."metric"
  AND m."threshold" = d."threshold"
  AND m."id" > d."id";--> statement-breakpoint
DROP INDEX IF EXISTS "member_milestones_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "member_milestones_unique" ON "member_milestones" USING btree ("account_id","kind","metric","threshold") NULLS NOT DISTINCT;
