-- Multi-clan: introduce the `clans` tenant row and scope the root tables to it.
--
-- HAND-WRITTEN, not left as drizzle-kit emitted it. The generated version did two things that would
-- have failed or lost data on any database with rows in it:
--
--   1. `ADD COLUMN clan_id integer NOT NULL` with no default and no backfill. Postgres rejects that
--      outright on a non-empty table, so the migration would abort halfway through.
--   2. No genesis clan. Every existing row needs an owner, and nothing was creating one.
--
-- Order below is: create the tenant, mint the genesis clan from what the instance already calls
-- itself, add the column NULLABLE, backfill, and only then tighten to NOT NULL.
--
-- `settings` is deliberately NOT scoped here — see the note on that table in src/db/schema.ts.

CREATE TABLE "clans" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"custom_domain" text,
	"name" text NOT NULL,
	"in_game_name" text,
	"status" text DEFAULT 'active' NOT NULL,
	"plan" text DEFAULT 'free' NOT NULL,
	"member_cap" integer,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL
);--> statement-breakpoint

CREATE UNIQUE INDEX "clans_slug_unique" ON "clans" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "clans_custom_domain_unique" ON "clans" USING btree ("custom_domain");--> statement-breakpoint
CREATE INDEX "clans_status_idx" ON "clans" USING btree ("status");--> statement-breakpoint

-- The genesis clan: the single clan this database used to BE, now an explicit row.
--
-- Only minted when there is something to attach to it. A brand-new database gets no clan here —
-- clans are created through onboarding, and inventing a placeholder would give the host resolver a
-- row that answers to a slug nobody owns.
--
-- Name and in-game name come from the settings this instance already carries, so the clan describes
-- itself correctly rather than being labelled "default". The slug is provisional: real slugs arrive
-- with the per-clan importer, and an operator renames this one if it is ever served.
INSERT INTO "clans" ("slug", "name", "in_game_name")
SELECT
	'genesis',
	COALESCE(NULLIF(TRIM((SELECT "value" FROM "settings" WHERE "key" = 'clan_name')), ''), 'Anvil'),
	NULLIF(TRIM((SELECT "value" FROM "settings" WHERE "key" = 'clan_ingame_name')), '')
WHERE EXISTS (SELECT 1 FROM "events")
   OR EXISTS (SELECT 1 FROM "clan_members")
   OR EXISTS (SELECT 1 FROM "settings");--> statement-breakpoint

-- Nullable first, so the ADD succeeds whatever is already stored.
ALTER TABLE "clan_members" ADD COLUMN "clan_id" integer;--> statement-breakpoint
ALTER TABLE "event_presets" ADD COLUMN "clan_id" integer;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "clan_id" integer;--> statement-breakpoint
ALTER TABLE "feedback" ADD COLUMN "clan_id" integer;--> statement-breakpoint
ALTER TABLE "tile_library" ADD COLUMN "clan_id" integer;--> statement-breakpoint
ALTER TABLE "weekly_competitions" ADD COLUMN "clan_id" integer;--> statement-breakpoint

-- Backfill: everything that existed before this migration belonged to the one clan.
UPDATE "clan_members"        SET "clan_id" = (SELECT MIN("id") FROM "clans") WHERE "clan_id" IS NULL;--> statement-breakpoint
UPDATE "event_presets"       SET "clan_id" = (SELECT MIN("id") FROM "clans") WHERE "clan_id" IS NULL;--> statement-breakpoint
UPDATE "events"              SET "clan_id" = (SELECT MIN("id") FROM "clans") WHERE "clan_id" IS NULL;--> statement-breakpoint
UPDATE "feedback"            SET "clan_id" = (SELECT MIN("id") FROM "clans") WHERE "clan_id" IS NULL;--> statement-breakpoint
UPDATE "tile_library"        SET "clan_id" = (SELECT MIN("id") FROM "clans") WHERE "clan_id" IS NULL;--> statement-breakpoint
UPDATE "weekly_competitions" SET "clan_id" = (SELECT MIN("id") FROM "clans") WHERE "clan_id" IS NULL;--> statement-breakpoint

-- Now it can be required. If a backfill above missed a row this fails loudly, which is what we want:
-- an unowned row is exactly the bug this whole column exists to prevent.
ALTER TABLE "clan_members" ALTER COLUMN "clan_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "event_presets" ALTER COLUMN "clan_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "clan_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "feedback" ALTER COLUMN "clan_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "tile_library" ALTER COLUMN "clan_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "weekly_competitions" ALTER COLUMN "clan_id" SET NOT NULL;--> statement-breakpoint

ALTER TABLE "clan_members" ADD CONSTRAINT "clan_members_clan_id_clans_id_fk" FOREIGN KEY ("clan_id") REFERENCES "public"."clans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_presets" ADD CONSTRAINT "event_presets_clan_id_clans_id_fk" FOREIGN KEY ("clan_id") REFERENCES "public"."clans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_clan_id_clans_id_fk" FOREIGN KEY ("clan_id") REFERENCES "public"."clans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_clan_id_clans_id_fk" FOREIGN KEY ("clan_id") REFERENCES "public"."clans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tile_library" ADD CONSTRAINT "tile_library_clan_id_clans_id_fk" FOREIGN KEY ("clan_id") REFERENCES "public"."clans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_competitions" ADD CONSTRAINT "weekly_competitions_clan_id_clans_id_fk" FOREIGN KEY ("clan_id") REFERENCES "public"."clans"("id") ON DELETE cascade ON UPDATE no action;
