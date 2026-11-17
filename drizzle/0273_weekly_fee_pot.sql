-- Entry fees added to a competition's prizes (lib/weeklySignups, lib/weeklyPrizes feePlaces).
-- fees_to_prizes: a settled fee is credited to the clan coffer and paid out on top of the ladder.
-- fee_in_coffer: this entrant's fee has been credited (so an undo takes back exactly what went in).
ALTER TABLE "weekly_competitions" ADD COLUMN IF NOT EXISTS "fees_to_prizes" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "weekly_participants" ADD COLUMN IF NOT EXISTS "fee_in_coffer" boolean DEFAULT false NOT NULL;
