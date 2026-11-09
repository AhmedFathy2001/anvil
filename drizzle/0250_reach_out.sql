ALTER TABLE "clans" ADD COLUMN IF NOT EXISTS "found_via" text;
--> statement-breakpoint
ALTER TABLE "clans" ADD COLUMN IF NOT EXISTS "found_via_note" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "welcomed_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "anvil_dms" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "notice_sound" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "platform_notices" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"link_url" text,
	"link_label" text,
	"audience" text NOT NULL,
	"in_plugin" boolean DEFAULT false NOT NULL,
	"in_brief" boolean DEFAULT false NOT NULL,
	"by_dm" boolean DEFAULT false NOT NULL,
	"level" text DEFAULT 'info' NOT NULL,
	"created_by_user_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"dm_sent_at" timestamp with time zone,
	"dm_sent_count" integer DEFAULT 0 NOT NULL,
	"withdrawn_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "platform_notices_created_idx" ON "platform_notices" ("created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "platform_notice_reads" (
	"notice_id" integer NOT NULL REFERENCES "platform_notices"("id") ON DELETE CASCADE,
	"user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"read_at" timestamp with time zone,
	"panel_hidden_at" timestamp with time zone,
	"briefed_at" timestamp with time zone,
	CONSTRAINT "platform_notice_reads_notice_id_user_id_pk" PRIMARY KEY("notice_id","user_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "platform_notice_reads_user_idx" ON "platform_notice_reads" ("user_id");
