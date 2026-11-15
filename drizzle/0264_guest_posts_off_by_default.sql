-- Posting in clans where you are only a guest is now OFF unless the player turns it on.
--
-- `users.block_guest_emissions` = true means "keep my drops, deaths, pets and levels out of clans
-- where I only hold a guest seat". It defaulted to false (0086), so every player announced in every
-- clan they guested in without ever having been asked. The stored meaning does not change; only the
-- default does. A player's own clan is unaffected, bingo proofs still reach the clan running the
-- board, and a single guest clan can still be allowed from the character's page in Settings.
--
-- Numbered 0264 because beta already holds 0263_notify_tier_inherit.

-- 1. New accounts: quiet in guest clans by default.
ALTER TABLE "users" ALTER COLUMN "block_guest_emissions" SET DEFAULT true;
--> statement-breakpoint
-- 2. EXISTING accounts: also made quiet. OPTIONAL -- delete this one statement (and the breakpoint
--    line above it) to change new accounts only. Nobody chose the old value (it was the default),
--    but the column cannot tell a player who left the switch alone from one who would have picked
--    "post": after this runs, NO existing player posts in a guest clan until they turn it on in
--    Settings, or allow one clan from a character's page.
UPDATE "users" SET "block_guest_emissions" = true WHERE "block_guest_emissions" = false;
