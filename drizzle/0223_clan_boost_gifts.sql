ALTER TABLE "clan_boost_state" ADD COLUMN "gift_level" integer;
ALTER TABLE "clan_boost_state" ADD COLUMN "gift_expires_at" text;
ALTER TABLE "clan_boost_state" ADD COLUMN "gifted_by" integer REFERENCES "users"("id") ON DELETE SET NULL;
