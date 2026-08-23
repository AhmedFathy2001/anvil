-- The item-by-item half of a member's progress: which quests, and later which combat tasks.
--
-- Keyed on the ACCOUNT, not the roster seat. Beta keyed this to clan_members, which does not
-- survive the identity split — a person guesting in ten clans would carry ten copies of the same
-- ~200-entry quest list, and every one of them would have to be kept in step.

CREATE TABLE IF NOT EXISTS "member_progress_items" (
  "id" serial PRIMARY KEY NOT NULL,
  "account_id" integer NOT NULL REFERENCES "accounts"("id") ON DELETE cascade,
  "category" text NOT NULL,
  "payload" text NOT NULL,
  "done_count" integer DEFAULT 0 NOT NULL,
  "total_count" integer DEFAULT 0 NOT NULL,
  "updated_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "member_progress_items_unique"
  ON "member_progress_items" ("account_id", "category");
