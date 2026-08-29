-- Backfill every clan's Gumroad checkout ref.
--
-- The webhook keys a payment to its clan by `gumroad_ref` (the token appended to the checkout URL),
-- but nothing ever set it — so correlation silently fell back to matching by email. New clans now get
-- a ref at creation (lib/clanCreate); this fills in the ones that predate that, so every upgrade link
-- can carry the strong key. A 32-char hex token, unique per clan.
UPDATE "clans"
SET "gumroad_ref" = replace(gen_random_uuid()::text, '-', '')
WHERE "gumroad_ref" IS NULL;
