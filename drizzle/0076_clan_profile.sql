-- The public clan home: a face for strangers, and the discovery switches.
--
-- `focus` and `requirements` are JSON so a clan is not pinned to one category and a recruit's bar can
-- grow new fields without a migration. "listed" (directory/leaderboard visibility) deliberately stays
-- the existing `public_showcase` setting for now — promoting it to a column means migrating every
-- reader, a separate pass.
ALTER TABLE "clans"
  ADD COLUMN IF NOT EXISTS "tagline" text,
  ADD COLUMN IF NOT EXISTS "description" text,
  ADD COLUMN IF NOT EXISTS "focus" jsonb DEFAULT '[]'::jsonb NOT NULL,
  ADD COLUMN IF NOT EXISTS "recruiting" boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS "open_to_challenges" boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS "requirements" jsonb DEFAULT '{}'::jsonb NOT NULL;
