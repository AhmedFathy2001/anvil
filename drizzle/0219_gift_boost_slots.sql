-- A staff gift of Supporter time (lib/supporterGifts) may come WITH clan boost slots or without
-- (lib/clanBoostRules slotTier). Default without: a gift is flair unless staff say otherwise. Paid
-- memberships always carry slots and invite-earned time never does, so only gift rows read this.
-- Numbered 0219 (0218 is clan_boosts).
ALTER TABLE "supporter_subscriptions" ADD COLUMN IF NOT EXISTS "grants_boost_slots" boolean DEFAULT false NOT NULL;
