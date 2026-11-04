-- A clan's / creator space's own colours (lib/artPalette, the "Colours" settings card).
--   accent_color  the #rrggbb an admin picked; NULL = Anvil gold everywhere, exactly as before
--   art_palette   { "from": "<logo url>|<banner url>", "colors": ["#rrggbb", …] } — swatches pulled
--                 from the logo and banner, and what they were pulled from, so a new upload re-picks
-- Both optional and read only by the settings card and the pages that opt in.
ALTER TABLE "clans" ADD COLUMN IF NOT EXISTS "accent_color" text;--> statement-breakpoint
ALTER TABLE "clans" ADD COLUMN IF NOT EXISTS "art_palette" jsonb;
