-- A clan's own image.
--
-- Every clan already had a crest — a letter on a gradient derived from its slug (components/
-- ClanCrest) — so this is an upgrade on something that already works rather than a hole being
-- filled. Null keeps the generated one.
--
-- A column rather than a setting: the directory renders every clan at once and reads `clans`
-- directly, so a setting would mean a second left join on every listing for a value that belongs to
-- the clan as plainly as its name does.
ALTER TABLE "clans" ADD COLUMN IF NOT EXISTS "logo_url" text;
