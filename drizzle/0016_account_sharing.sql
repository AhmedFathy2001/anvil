-- Which of a person's accounts a clan is allowed to know about.
--
-- One account token now covers every account a person owns, across every clan. That is the right
-- model — Jagex tracks accounts, a person owns several, and re-linking per clan was the thing
-- everyone hated — but it means a clan holding one of your accounts must not thereby learn the rest.
-- Someone guesting into a clan with an alt has not told that clan about their main.
--
-- So the rule is: a clan may see an account if that account has a SEAT in the clan, or if the person
-- marked it shared. Default false, because the safe answer is the one nobody has to think about, and
-- because sharing is a decision rather than a state you drift into.
--
-- Per ACCOUNT, not per person: "my main is public, my ironman is nobody's business" is the actual
-- want, and a person-level flag cannot say it.

ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "shared" boolean DEFAULT false NOT NULL;

-- The visibility check runs on every clan-side read of someone's accounts, so it gets an index on
-- the two columns it filters by.
CREATE INDEX IF NOT EXISTS "accounts_player_shared_idx" ON "accounts" ("player_id", "shared");
