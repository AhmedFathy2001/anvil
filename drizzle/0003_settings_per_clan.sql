-- Scope `settings` to the clan. The key is unique only WITHIN a clan now.
--
-- HAND-WRITTEN. drizzle-kit's version could not run at all: it added the composite primary key
-- BEFORE the column it names existed, added that column NOT NULL with no default onto a populated
-- table, and left the old primary key's DROP as a commented-out placeholder for a human to fill in.
--
-- Order here is the executable one — column, backfill, tighten, swap the key — and the backfill has
-- a real decision in it, below.

ALTER TABLE "settings" ADD COLUMN "clan_id" integer;--> statement-breakpoint

-- Existing rows belong to the genesis clan: this database was one clan's, so its settings were too.
--
-- MIN(id) rather than a hardcoded 1 because the genesis clan is only minted when there was data to
-- attach (see 0001), so on a database that never had any there is no clan and no settings row either
-- — the UPDATE matches nothing and the NOT NULL below is trivially satisfied.
UPDATE "settings" SET "clan_id" = (SELECT MIN("id") FROM "clans") WHERE "clan_id" IS NULL;--> statement-breakpoint

-- A settings row that survived with no clan would be config nobody can reach — but deleting a
-- clan's configuration to make a migration pass is the wrong trade every time. Abort instead, and
-- let a human decide which clan it belonged to.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "settings" WHERE "clan_id" IS NULL) THEN
    RAISE EXCEPTION 'settings rows with no owning clan: resolve these before migrating (see 0001 for how the genesis clan is minted)';
  END IF;
END $$;--> statement-breakpoint
ALTER TABLE "settings" ALTER COLUMN "clan_id" SET NOT NULL;--> statement-breakpoint

ALTER TABLE "settings" DROP CONSTRAINT "settings_pkey";--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_clan_id_key_pk" PRIMARY KEY("clan_id","key");--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_clan_id_clans_id_fk" FOREIGN KEY ("clan_id") REFERENCES "public"."clans"("id") ON DELETE cascade ON UPDATE no action;
