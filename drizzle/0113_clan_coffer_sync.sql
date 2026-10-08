CREATE TABLE IF NOT EXISTS "clan_coffer_sync_state" (
	"clan_id" integer PRIMARY KEY NOT NULL,
	"balance" bigint NOT NULL,
	"observed_by_clan_member_id" integer,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_event_key" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "clan_coffer_sync_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"clan_id" integer NOT NULL,
	"event_key" text NOT NULL,
	"kind" text NOT NULL,
	"outcome" text NOT NULL,
	"amount" bigint DEFAULT 0 NOT NULL,
	"before_balance" bigint NOT NULL,
	"after_balance" bigint NOT NULL,
	"actor_confirmed" boolean DEFAULT false NOT NULL,
	"clan_member_id" integer,
	"rsn" text,
	"coffer_entry_id" integer,
	"plugin_version" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "clan_coffer_sync_state" ADD CONSTRAINT "clan_coffer_sync_state_clan_id_clans_id_fk" FOREIGN KEY ("clan_id") REFERENCES "public"."clans"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "clan_coffer_sync_state" ADD CONSTRAINT "clan_coffer_sync_state_observed_by_clan_member_id_clan_memberships_id_fk" FOREIGN KEY ("observed_by_clan_member_id") REFERENCES "public"."clan_memberships"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "clan_coffer_sync_events" ADD CONSTRAINT "clan_coffer_sync_events_clan_id_clans_id_fk" FOREIGN KEY ("clan_id") REFERENCES "public"."clans"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "clan_coffer_sync_events" ADD CONSTRAINT "clan_coffer_sync_events_clan_member_id_clan_memberships_id_fk" FOREIGN KEY ("clan_member_id") REFERENCES "public"."clan_memberships"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "clan_coffer_sync_events" ADD CONSTRAINT "clan_coffer_sync_events_coffer_entry_id_coffer_entries_id_fk" FOREIGN KEY ("coffer_entry_id") REFERENCES "public"."coffer_entries"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "clan_coffer_sync_events_clan_event_unique" ON "clan_coffer_sync_events" USING btree ("clan_id","event_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "clan_coffer_sync_events_clan_created_idx" ON "clan_coffer_sync_events" USING btree ("clan_id","created_at");
