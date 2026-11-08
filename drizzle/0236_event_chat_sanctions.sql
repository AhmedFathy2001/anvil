-- Event chat moderation (lib/eventChat): a mute becomes a timeout (until a time) or a ban (until
-- lifted), with the moderator's reason. `until` is the timeout's expiry; a ban keeps it null. Existing
-- rows were the plugin's "mute for the rest of the event" (until null), which is a ban.
ALTER TABLE "event_chat_mutes" ADD COLUMN IF NOT EXISTS "kind" text DEFAULT 'ban' NOT NULL;--> statement-breakpoint
ALTER TABLE "event_chat_mutes" ADD COLUMN IF NOT EXISTS "reason" text;--> statement-breakpoint
UPDATE "event_chat_mutes" SET "kind" = 'timeout' WHERE "until" IS NOT NULL;
