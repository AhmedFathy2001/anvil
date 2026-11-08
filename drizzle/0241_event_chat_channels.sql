-- Event chat channels (lib/eventChat): every line is in one channel, 'all' (everyone on the board),
-- 'team:<id>' (one team and the host's staff) or 'announce' (staff post, everyone reads). Lines said
-- team-only before this go to their team's channel. event_chat_reads: how far each person has read
-- each channel, for the unread counts on the plugin's channel switch.
ALTER TABLE "event_chat_messages" ADD COLUMN IF NOT EXISTS "channel" text DEFAULT 'all' NOT NULL;--> statement-breakpoint
UPDATE "event_chat_messages" SET "channel" = 'team:' || "team_id" WHERE "team_only" AND "team_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_chat_messages_channel_idx" ON "event_chat_messages" USING btree ("event_id","channel","id");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "event_chat_reads" (
	"event_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"channel" text NOT NULL,
	"last_id" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "event_chat_reads_event_id_user_id_channel_pk" PRIMARY KEY("event_id","user_id","channel")
);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "event_chat_reads" ADD CONSTRAINT "event_chat_reads_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "event_chat_reads" ADD CONSTRAINT "event_chat_reads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
