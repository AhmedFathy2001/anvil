-- Billing moves onto the clan row, because there is no control plane to hold it any more.
--
-- These columns lived in Anvil.Admin's own database, which existed to know which CONTAINER belonged
-- to which subscription. There are no containers now — a clan is a row here — so the subscription
-- belongs on that row, and the site can answer "what is this clan entitled to" without asking
-- anything else.
--
-- STATUS AND PLAN BECOME DIFFERENT QUESTIONS. The control plane needed statuses like
-- awaiting_payment and provisioning because a clan did not EXIST until it was paid for and built.
-- Under freemium a clan exists the moment it is created, on the free tier, and paying changes what
-- it is ENTITLED to rather than whether it is there. So `plan` carries entitlement and `status`
-- stays what it was: is this clan serving at all. Refunds and disputes still touch status, because
-- those are the cases where a clan should stop serving.

ALTER TABLE "clans" ADD COLUMN IF NOT EXISTS "contact_email" text;

-- Gumroad is the merchant of record; these are its handles for the subscription behind this clan.
ALTER TABLE "clans" ADD COLUMN IF NOT EXISTS "gumroad_sale_id" text;
ALTER TABLE "clans" ADD COLUMN IF NOT EXISTS "gumroad_subscription_id" text;
ALTER TABLE "clans" ADD COLUMN IF NOT EXISTS "gumroad_product_id" text;
ALTER TABLE "clans" ADD COLUMN IF NOT EXISTS "gumroad_product_permalink" text;
-- The correlation token we append to the checkout URL and Gumroad echoes back, which is how a
-- payment finds the clan that started it.
ALTER TABLE "clans" ADD COLUMN IF NOT EXISTS "gumroad_ref" text;

ALTER TABLE "clans" ADD COLUMN IF NOT EXISTS "trial_ends_at" text;
ALTER TABLE "clans" ADD COLUMN IF NOT EXISTS "current_period_end" text;
-- Cancelled but still inside the paid term. Gumroad keeps serving it, so we do too — dropping the
-- clan to free the moment someone cancels would take away time they already paid for.
ALTER TABLE "clans" ADD COLUMN IF NOT EXISTS "cancel_at_period_end" boolean DEFAULT false NOT NULL;

-- One subscription is one clan. Partial, because free clans have no subscription and NULL is not a
-- duplicate — but two clans claiming the same paid subscription is a billing bug that should be
-- impossible rather than merely unlikely.
CREATE UNIQUE INDEX IF NOT EXISTS "clans_gumroad_subscription_unique"
  ON "clans" ("gumroad_subscription_id") WHERE "gumroad_subscription_id" IS NOT NULL;

-- Same for the correlation token: it identifies exactly one reservation.
CREATE UNIQUE INDEX IF NOT EXISTS "clans_gumroad_ref_unique"
  ON "clans" ("gumroad_ref") WHERE "gumroad_ref" IS NOT NULL;

-- The webhook looks a clan up by subscription on every renewal.
CREATE INDEX IF NOT EXISTS "clans_contact_email_idx" ON "clans" (lower("contact_email"));
