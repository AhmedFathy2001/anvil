-- Where the Discord id stored on a character came from.
--
-- `accounts.discord_id` is written three ways (a sign-in / sign-up / plugin report the database can
-- prove, an admin linking a member by hand, and the old nickname matching) and nothing recorded
-- which. With a clan's nickname matching off, role sync therefore had to ignore every stored id,
-- hand-made links included. These columns record it:
--
--   discord_id_source             'admin' | 'name' | 'login' | 'signup' | 'plugin'; NULL = unknown
--   discord_id_linked_by_user_id  the admin who made a hand link
--   discord_id_linked_at          when
--   discord_id_linked_clan_id     the clan whose admin made it. A character is shared by every clan
--                                 that seats it, so a hand link is trusted only in the clan that made it.
--
-- EXISTING ROWS STAY NULL (unknown): nothing can tell an old hand link from an old nickname match,
-- so each counts as unconfirmed until an admin links it again or the member signs in. No data moves.
--
-- Numbered 0265: beta ends at 0263 and this branch's base holds 0264.
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "discord_id_source" text;
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "discord_id_linked_by_user_id" integer;
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "discord_id_linked_at" text;
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "discord_id_linked_clan_id" integer;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "accounts" ADD CONSTRAINT "accounts_discord_id_linked_by_user_id_users_id_fk" FOREIGN KEY ("discord_id_linked_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "accounts" ADD CONSTRAINT "accounts_discord_id_linked_clan_id_clans_id_fk" FOREIGN KEY ("discord_id_linked_clan_id") REFERENCES "public"."clans"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "accounts" ADD CONSTRAINT "accounts_discord_id_source_check" CHECK ("discord_id_source" IS NULL OR "discord_id_source" IN ('admin', 'name', 'login', 'signup', 'plugin'));
EXCEPTION WHEN duplicate_object THEN null; END $$;
