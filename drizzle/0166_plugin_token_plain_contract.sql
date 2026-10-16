-- Plugin tokens: stop keeping them in the clear (CONTRACT half of 0138).
--
-- Every reader now looks tokens up by hash, so the plain copies are only a liability: a database or
-- backup leak would still hand out every account. Hashes are re-filled first for any row written
-- without one (an older slot mid-switch, scripts/import-clan), then the plain values are erased.
UPDATE "users" SET "plugin_token_hash" = encode(sha256(convert_to("plugin_token", 'UTF8')), 'hex')
  WHERE "plugin_token" IS NOT NULL AND "plugin_token_hash" IS NULL;--> statement-breakpoint
UPDATE "plugin_links" SET "token_hash" = encode(sha256(convert_to("token", 'UTF8')), 'hex')
  WHERE "token" IS NOT NULL AND "token_hash" IS NULL;--> statement-breakpoint
UPDATE "users" SET "plugin_token" = NULL WHERE "plugin_token" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "plugin_links" ALTER COLUMN "token" DROP NOT NULL;--> statement-breakpoint
UPDATE "plugin_links" SET "token" = NULL WHERE "token" IS NOT NULL;
