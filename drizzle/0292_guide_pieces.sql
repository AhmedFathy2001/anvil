-- Guide pieces (lib/guidePieces): a library guide made of small pieces a clan can override one at a
-- time, the history of both, and guide_areas (map regions per content) replacing the pre-trip
-- check's hardcoded regions. Existing guides are untouched; nothing is converted here.
CREATE TABLE IF NOT EXISTS "guide_pieces" (
  "id" serial PRIMARY KEY,
  "guide_id" integer NOT NULL REFERENCES "guides"("id") ON DELETE CASCADE,
  "section_key" text NOT NULL DEFAULT 'tactics',
  "role_key" text NOT NULL DEFAULT '*',
  "variant" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "kind" text NOT NULL,
  "body" jsonb NOT NULL,
  "position" integer NOT NULL DEFAULT 0,
  "version" integer NOT NULL DEFAULT 1,
  "status" text NOT NULL DEFAULT 'draft',
  "created_by_user_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "updated_by_user_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" text NOT NULL,
  "updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "guide_pieces_guide_idx" ON "guide_pieces" ("guide_id", "section_key", "position");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "guide_piece_overrides" (
  "id" serial PRIMARY KEY,
  "clan_id" integer NOT NULL REFERENCES "clans"("id") ON DELETE CASCADE,
  "piece_id" integer REFERENCES "guide_pieces"("id") ON DELETE SET NULL,
  "guide_id" integer NOT NULL REFERENCES "guides"("id") ON DELETE CASCADE,
  "section_key" text NOT NULL DEFAULT 'tactics',
  "role_key" text NOT NULL DEFAULT '*',
  "variant" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "kind" text NOT NULL,
  "body" jsonb,
  "hidden" boolean NOT NULL DEFAULT false,
  "position" integer,
  "based_on_version" integer,
  "version" integer NOT NULL DEFAULT 1,
  "created_by_user_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "updated_by_user_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" text NOT NULL,
  "updated_at" text NOT NULL,
  CONSTRAINT "guide_piece_overrides_clan_piece_unique" UNIQUE ("clan_id", "piece_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "guide_piece_overrides_clan_guide_idx" ON "guide_piece_overrides" ("clan_id", "guide_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "guide_piece_overrides_piece_idx" ON "guide_piece_overrides" ("piece_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "guide_piece_revisions" (
  "id" serial PRIMARY KEY,
  "clan_id" integer REFERENCES "clans"("id") ON DELETE CASCADE,
  "guide_id" integer NOT NULL REFERENCES "guides"("id") ON DELETE CASCADE,
  "piece_id" integer REFERENCES "guide_pieces"("id") ON DELETE SET NULL,
  "override_id" integer REFERENCES "guide_piece_overrides"("id") ON DELETE SET NULL,
  "version" integer NOT NULL,
  "kind" text NOT NULL,
  "body" jsonb,
  "hidden" boolean NOT NULL DEFAULT false,
  "meta" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "action" text NOT NULL,
  "edited_by_user_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "guide_piece_revisions_piece_idx" ON "guide_piece_revisions" ("piece_id", "version");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "guide_piece_revisions_override_idx" ON "guide_piece_revisions" ("override_id", "version");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "guide_piece_revisions_clan_guide_idx" ON "guide_piece_revisions" ("clan_id", "guide_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "guide_areas" (
  "id" serial PRIMARY KEY,
  "content_key" text NOT NULL,
  "guide_id" integer REFERENCES "guides"("id") ON DELETE SET NULL,
  "region_id" integer NOT NULL,
  "label" text NOT NULL,
  "trip_check" boolean NOT NULL DEFAULT true,
  "cues" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "no_bank" boolean NOT NULL DEFAULT false,
  "created_at" text NOT NULL,
  "updated_at" text NOT NULL,
  CONSTRAINT "guide_areas_content_region_unique" UNIQUE ("content_key", "region_id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "guide_areas_trip_region_unique" ON "guide_areas" ("region_id") WHERE trip_check;
--> statement-breakpoint
-- The regions the pre-trip check shipped with (lib/tripContent TRIP_REGIONS, kept there as the
-- fallback). The library guide, where the content names one, by slug; null when it isn't there.
INSERT INTO "guide_areas" ("content_key", "guide_id", "region_id", "label", "trip_check", "cues", "no_bank", "created_at", "updated_at")
SELECT v.content_key, g.id, v.region_id, v.label, true, v.cues::jsonb, v.no_bank, to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
FROM (VALUES
  ('toa', 'tombs-of-amascut-entry', 13454, 'the ToA lobby', '[]', false),
  ('tob', NULL, 14642, 'Ver Sinhaza', '[]', false),
  ('cox', 'chambers-of-xeric-learner', 4919, 'Mount Quidamortem', '[]', false),
  ('vorkath', 'vorkath-guide', 9023, 'Ungael', '[]', true),
  ('zulrah', NULL, 8751, 'Zul-Andra', '[]', true),
  ('barrows', 'barrows-beginners', 12344, 'Ferox Enclave', '[952]', false),
  ('barrows', 'barrows-beginners', 14131, 'the Barrows', '[]', true),
  ('nex', NULL, 11601, 'the Nex bank', '[]', false)
) AS v(content_key, slug, region_id, label, cues, no_bank)
LEFT JOIN "guides" g ON g.clan_id IS NULL AND g.slug = v.slug
ON CONFLICT DO NOTHING;
