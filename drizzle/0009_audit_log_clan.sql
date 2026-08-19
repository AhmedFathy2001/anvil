-- Give the audit log a clan of its own.
--
-- It derived one through clan_member_id, which works for everything that happens TO a roster seat —
-- renames, claims, joins, bans. It does not work for the things a clan's audit trail most needs to
-- record: a role granted, a setting changed, an owner transferred. Those concern the clan, not a
-- seat, so under the old shape they had nowhere to be filed and would have shown up in every clan's
-- log at once, or in none.

ALTER TABLE "clan_audit_log" ADD COLUMN "clan_id" integer;--> statement-breakpoint

-- Existing entries all belong to a seat, so their clan is the seat's clan.
UPDATE "clan_audit_log" a
SET "clan_id" = m."clan_id"
FROM "clan_memberships" m
WHERE m."id" = a."clan_member_id" AND a."clan_id" IS NULL;--> statement-breakpoint

-- Anything left has no seat to inherit from, which on a pre-migration database means it predates
-- clans entirely: file it under the genesis clan rather than losing it.
UPDATE "clan_audit_log"
SET "clan_id" = (SELECT MIN("id") FROM "clans")
WHERE "clan_id" IS NULL AND EXISTS (SELECT 1 FROM "clans");--> statement-breakpoint

ALTER TABLE "clan_audit_log" ADD CONSTRAINT "clan_audit_log_clan_id_clans_id_fk" FOREIGN KEY ("clan_id") REFERENCES "public"."clans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "clan_audit_log_clan_idx" ON "clan_audit_log" USING btree ("clan_id","occurred_at");
