-- Plugin tokens, stored as hashes (EXPAND half; 0139 is the contract).
--
-- A plugin token is a password: whoever holds it acts as that person in every plugin call. Stored in
-- the clear, a database or backup leak handed out every account at once. Requests are now looked up
-- by SHA-256 of the token. The plain columns stay — and are still written — while blue-green slots
-- overlap and a rollback must keep working; 0139 empties them once this is live everywhere.
--
-- sha256() is built into Postgres 11+, so no extension is needed.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "plugin_token_hash" text;--> statement-breakpoint
ALTER TABLE "plugin_links" ADD COLUMN IF NOT EXISTS "token_hash" text;--> statement-breakpoint
UPDATE "users" SET "plugin_token_hash" = encode(sha256(convert_to("plugin_token", 'UTF8')), 'hex')
  WHERE "plugin_token" IS NOT NULL AND "plugin_token_hash" IS NULL;--> statement-breakpoint
UPDATE "plugin_links" SET "token_hash" = encode(sha256(convert_to("token", 'UTF8')), 'hex')
  WHERE "token_hash" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_plugin_token_hash_unique" ON "users" USING btree ("plugin_token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "plugin_links_token_hash_unique" ON "plugin_links" USING btree ("token_hash");
