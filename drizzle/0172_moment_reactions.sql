-- Reactions on a moment (a pet, a unique) from the plugin panel's Recent drops: 'gz' for anyone,
-- 'gold' for Anvil Supporters (lib/momentReactions). One of each kind per person per moment.
CREATE TABLE IF NOT EXISTS "moment_reactions" (
  "id" serial PRIMARY KEY NOT NULL,
  "moment_id" integer NOT NULL REFERENCES "moments"("id") ON DELETE CASCADE,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "kind" text NOT NULL,
  "created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "moment_reactions_one_each" ON "moment_reactions" ("moment_id", "user_id", "kind");
