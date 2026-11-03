-- Anvil Supporter name colours: a Champion picks a preset gradient, a Patron a preset or their own
-- stops (lib/supporterStyle). JSON text, NULL = the tier's default. IF NOT EXISTS so a re-run is harmless.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "supporter_style" text;
