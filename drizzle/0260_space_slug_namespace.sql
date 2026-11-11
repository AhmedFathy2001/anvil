-- Creator spaces get their own address namespace (/s/<slug>), separate from clans (/c/<slug>).
-- A slug is now unique per namespace rather than globally, so a streamer's space no longer blocks
-- a real clan of the same name. Friends hosts are addressed as clans, so they share the clan side.
CREATE UNIQUE INDEX IF NOT EXISTS "clans_namespace_slug_unique"
  ON "clans" ((case when "kind" = 'creator' then 'creator' else 'clan' end), "slug");
--> statement-breakpoint
DROP INDEX IF EXISTS "clans_slug_unique";
--> statement-breakpoint
-- Retired addresses belong to a namespace too: a clan giving up /c/x says nothing about /s/x.
ALTER TABLE "retired_clan_slugs" ADD COLUMN IF NOT EXISTS "kind" text DEFAULT 'clan' NOT NULL;
--> statement-breakpoint
UPDATE "retired_clan_slugs" r SET "kind" = 'creator'
  FROM "clans" c WHERE c."id" = r."clan_id" AND c."kind" = 'creator';
--> statement-breakpoint
ALTER TABLE "retired_clan_slugs" DROP CONSTRAINT IF EXISTS "retired_clan_slugs_pkey";
--> statement-breakpoint
ALTER TABLE "retired_clan_slugs" ADD CONSTRAINT "retired_clan_slugs_kind_slug_pk" PRIMARY KEY ("kind", "slug");
