CREATE TABLE IF NOT EXISTS "error_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"fingerprint" text NOT NULL,
	"clan_id" integer,
	"name" text NOT NULL,
	"message" text NOT NULL,
	"stack" text,
	"path" text,
	"method" text,
	"source" text,
	"release" text,
	"count" integer DEFAULT 1 NOT NULL,
	"first_seen_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL,
	"last_seen_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL,
	"notified_count" integer DEFAULT 0 NOT NULL,
	"notified_at" text,
	"resolved_at" text,
	"resolved_by_user_id" integer,
	CONSTRAINT "error_events_fingerprint_clan_unique" UNIQUE NULLS NOT DISTINCT("fingerprint","clan_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "error_events" ADD CONSTRAINT "error_events_clan_id_clans_id_fk" FOREIGN KEY ("clan_id") REFERENCES "public"."clans"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "error_events" ADD CONSTRAINT "error_events_resolved_by_user_id_users_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "error_events_last_seen_idx" ON "error_events" USING btree ("last_seen_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "error_events_clan_idx" ON "error_events" USING btree ("clan_id");
