-- clan_extra_memberships (0267): three facts the owner notice and the fall-back need.
--   reason          why the membership is extra: 'superseded' (the older one after an upgrade) or
--                   'lower_tier' (a lower or equal tier bought while a higher one is live; the higher stays).
--   cancelled_at    Gumroad reported it cancelled. It still has paid term, so the row stays open
--                   (the fall-back can still find it) but the notice stops asking for a cancel.
--   period_ends_at  when its paid term runs out, as far as we know: "cancelled, ends <date>".
-- Additive. Numbered 0268 (0267 is the table itself).
ALTER TABLE "clan_extra_memberships" ADD COLUMN IF NOT EXISTS "reason" text;
--> statement-breakpoint
ALTER TABLE "clan_extra_memberships" ADD COLUMN IF NOT EXISTS "cancelled_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "clan_extra_memberships" ADD COLUMN IF NOT EXISTS "period_ends_at" timestamp with time zone;
