-- Boss Rush deaths: what kind of killer (a poison/venom death names the poison, lib/deathSource deathCause). Additive.
ALTER TABLE "rush_death_shots" ADD COLUMN IF NOT EXISTS "source_kind" text;
