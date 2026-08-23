-- Board-scoped staff grants: one job on one board, without the clan-wide role for it.
--
-- treasurer_scope goes on clan_staff, NOT on users. Beta put it on the user, which in a one-clan
-- deployment was the same thing — here it would make somebody a board-scoped treasurer in EVERY
-- clan at once, which is the shape the per-clan grant exists to prevent.

DROP INDEX IF EXISTS "event_editors_event_user_unique";

ALTER TABLE "event_editors" ADD COLUMN IF NOT EXISTS "role" text DEFAULT 'editor' NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "event_editors_event_user_role_unique"
  ON "event_editors" ("event_id", "user_id", "role");

ALTER TABLE "clan_staff" ADD COLUMN IF NOT EXISTS "treasurer_scope" text DEFAULT 'all' NOT NULL;
