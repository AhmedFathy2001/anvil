-- The character's game mode, as the plugin reads it from the in-game ironman varbit. See schema.ts
-- `accounts.accountType`. Nullable: unknown until a plugin reports it.
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "account_type" text;
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "account_type_at" text;
