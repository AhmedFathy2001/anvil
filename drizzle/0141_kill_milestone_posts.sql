-- Plugin kill tiles post at milestones (25/50/75% + completion) instead of every window — but ONLY
-- tiles created from now on. Expand-only.
--
-- Two statements on purpose: ADD COLUMN ... DEFAULT would stamp the default onto every existing row,
-- flipping posting on events that are already running. Adding the column bare leaves every existing
-- tile NULL (= the legacy post-per-window behaviour, unchanged); setting the default afterwards only
-- affects rows inserted later, by any write path (editor, CSV import, library, clone). Never backfill.
ALTER TABLE "tiles" ADD COLUMN IF NOT EXISTS "kill_posts" text;--> statement-breakpoint
ALTER TABLE "tiles" ALTER COLUMN "kill_posts" SET DEFAULT 'milestones';
