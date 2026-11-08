-- Drop thresholds now inherit: users.notify_prefs.dropMin / .rarity absent = follow the clan's default,
-- else Anvil's (1m, 1/1,000). A stored value equal to the old platform default (5m, 1/10,000) was almost
-- certainly never chosen, so it becomes "inherit"; anything else stays custom.
DO $$
DECLARE r record; j jsonb; changed boolean;
BEGIN
  FOR r IN SELECT id, notify_prefs FROM users WHERE notify_prefs IS NOT NULL LOOP
    BEGIN
      j := r.notify_prefs::jsonb;
      changed := false;
      IF jsonb_typeof(j) = 'object' THEN
        IF j->>'dropMin' = '5000000' THEN j := j - 'dropMin'; changed := true; END IF;
        IF j->>'rarity' = '10000' THEN j := j - 'rarity'; changed := true; END IF;
        IF changed THEN UPDATE users SET notify_prefs = j::text WHERE id = r.id; END IF;
      END IF;
    EXCEPTION WHEN others THEN
      NULL; -- unparseable JSON is read as "never set" by the app; leave it alone
    END;
  END LOOP;
END $$;
--> statement-breakpoint
-- Personal webhooks get their own drop filters (null = follow the person's effective thresholds).
-- min_value takes over the old gp floor in min_rarity (which no post path ever applied); min_rarity stays, unread.
ALTER TABLE "user_webhooks" ADD COLUMN IF NOT EXISTS "min_value" integer;
--> statement-breakpoint
ALTER TABLE "user_webhooks" ADD COLUMN IF NOT EXISTS "min_drop_rarity" integer;
--> statement-breakpoint
ALTER TABLE "user_webhooks" ADD COLUMN IF NOT EXISTS "min_drop_mode" text;
--> statement-breakpoint
UPDATE "user_webhooks" SET "min_value" = "min_rarity" WHERE "min_rarity" IS NOT NULL AND "min_rarity" > 0 AND "min_value" IS NULL;
