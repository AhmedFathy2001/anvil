-- A gift's tier and length are now chosen on anvilosrs.com, where we know what the recipient already
-- has (lib/supporterGiftCheckout). The sale must match the choice, or it's held for staff.
ALTER TABLE "supporter_gift_intents" ADD COLUMN IF NOT EXISTS "tier" text;
--> statement-breakpoint
ALTER TABLE "supporter_gift_intents" ADD COLUMN IF NOT EXISTS "months" integer;
