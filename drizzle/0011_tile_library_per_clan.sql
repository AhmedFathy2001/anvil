-- The seed key is unique WITHIN a clan, not across the deployment.
--
-- Every clan seeds its task library from the same file in the repo, so every clan has a row for
-- "zulrah-kc" — and a global unique index makes the second clan to be seeded, or imported, fail.
-- Caught by importing a second real clan: the same class of bug as the roster's rsn_normalized
-- index, which was global only by accident of one clan per database.
DROP INDEX IF EXISTS "tile_library_seed_key_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "tile_library_clan_seed_key_idx" ON "tile_library" USING btree ("clan_id","seed_key");
