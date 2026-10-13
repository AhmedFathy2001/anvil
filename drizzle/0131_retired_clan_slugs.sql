-- Clan addresses given up by a rename or a delete; never reissued (schema.ts retiredClanSlugs).
CREATE TABLE IF NOT EXISTS "retired_clan_slugs" (
	"slug" text PRIMARY KEY NOT NULL,
	"clan_id" integer REFERENCES "clans"("id") ON DELETE SET NULL,
	"retired_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL
);
