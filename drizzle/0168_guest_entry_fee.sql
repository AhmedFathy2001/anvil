-- Separate entry fee for guests, and a marker on fee rows a staff member priced by hand.
-- Journal `when` sits between 0165 (applied) and the reserved 0162 (fix/clan-event-posts,
-- 1793523200000), so this applies whichever of the pending branches lands first.
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "guest_signup_fee" integer;--> statement-breakpoint
ALTER TABLE "signup_fees" ADD COLUMN IF NOT EXISTS "custom_amount" boolean DEFAULT false NOT NULL;
