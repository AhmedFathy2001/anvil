-- Paid Supporter gifts (lib/supporterGiftPurchase): one person buys Supporter time for another, once,
-- with no renewal. The gift is an ordinary granted supporter_subscriptions row for the recipient;
-- these columns say who paid for it and for how long (the giver ladder counts them).
ALTER TABLE "supporter_subscriptions" ADD COLUMN IF NOT EXISTS "gifted_by_user_id" integer REFERENCES "users"("id") ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "supporter_subscriptions" ADD COLUMN IF NOT EXISTS "gift_months" integer;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "supporter_subscriptions_gifted_by_idx" ON "supporter_subscriptions" ("gifted_by_user_id");
--> statement-breakpoint
-- The checkout's correlation: an opaque token naming buyer and recipient, echoed back by Gumroad.
CREATE TABLE IF NOT EXISTS "supporter_gift_intents" (
  "token" text PRIMARY KEY NOT NULL,
  "buyer_user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "recipient_user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL,
  "used_sale_id" text
);
