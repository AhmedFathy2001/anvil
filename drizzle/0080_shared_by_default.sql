-- Characters are public unless their owner says otherwise.
--
-- `accounts.shared` decides whether clans you are NOT in may see a character. It defaulted to false,
-- which is the right default for a privacy flag read in isolation and the wrong one for what this
-- platform is: a cross-clan record. With nothing shared, the leaderboards, the clan directory and
-- every "what has this person done" surface can only describe people through the one clan you happen
-- to be looking at — which is exactly the per-clan silo that putting clans on one site was meant to
-- end.
--
-- SAFE TO FLIP THE EXISTING ROWS, and this is checked rather than assumed: all 531 accounts on the
-- first real database read `false`, and not one is an opt-OUT — the column has never been toggled by
-- anybody, so there is no decision here to override. A person who wants a character private turns
-- Share off on their profile, and that choice now means something because it is a choice.
--
-- NOTE what this does NOT change: a clan still sees every character seated on its own roster
-- regardless, and it never sees an account belonging to somebody with no seat and no share. The rule
-- in lib/accountVisibility is untouched — only its default answer moved.
ALTER TABLE "accounts" ALTER COLUMN "shared" SET DEFAULT true;
--> statement-breakpoint
UPDATE "accounts" SET "shared" = true WHERE "shared" = false;
--> statement-breakpoint
-- ...and the other half of the same decision: guest clans stay QUIET by default.
--
-- `accounts.shared` gates two different disclosures — who may SEE a character, and which clans
-- ANNOUNCE its drops. Those were one switch because both were off; flipping sharing on its own would
-- have started posting every player's drops into every clan they had ever guested in, on the grounds
-- that they let the leaderboards see them. That is not the same sentence.
--
-- So the person-level preference flips with it. Existing rows are updated for the same reason the
-- sharing flip is safe: the column has never been toggled, so there is no decision to override. A
-- member clan is unaffected — your own clan still announces unless you silence it — and the per-clan
-- whitelist still opts a single guest clan back in.
ALTER TABLE "users" ALTER COLUMN "block_guest_emissions" SET DEFAULT true;
--> statement-breakpoint
UPDATE "users" SET "block_guest_emissions" = true WHERE "block_guest_emissions" = false;
