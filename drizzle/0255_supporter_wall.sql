-- The public supporters wall on /supporter (lib/supporterWall): every Supporter is on it by default,
-- under one of their publicly shared characters; this is their opt-out.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "supporter_wall" boolean DEFAULT true NOT NULL;
