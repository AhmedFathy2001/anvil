-- The pre-trip check (lib/tripCheck). The plugin's spellbook, rune pouch and unlocked prayers ride on
-- the item push as `state` and are stored on a container 'state' row of player_item_snapshots, so they
-- keep the snapshots' owner-only rule and go with them. trip_setups: a player's own saved setup per trip.
ALTER TABLE "player_item_snapshots" ADD COLUMN IF NOT EXISTS "state" jsonb;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "trip_setups" (
  "account_id" integer NOT NULL REFERENCES "accounts"("id") ON DELETE CASCADE,
  "content" text NOT NULL,
  "setup" jsonb NOT NULL,
  "created_at" text NOT NULL,
  "updated_at" text NOT NULL,
  PRIMARY KEY ("account_id", "content")
);
