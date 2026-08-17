CREATE TABLE "moments" (
	"id" serial PRIMARY KEY NOT NULL,
	"clan_member_id" integer NOT NULL,
	"rsn" text NOT NULL,
	"kind" text NOT NULL,
	"weekly_competition_id" integer,
	"event_id" integer,
	"item_id" integer,
	"item_name" text,
	"quantity" integer DEFAULT 1 NOT NULL,
	"value_gp" integer,
	"source" text,
	"source_kind" text,
	"kc" integer,
	"rarity_denominator" integer,
	"occurred_at" text NOT NULL,
	"noticed_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL,
	"dedup_key" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "moments" ADD CONSTRAINT "moments_clan_member_id_clan_members_id_fk" FOREIGN KEY ("clan_member_id") REFERENCES "public"."clan_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moments" ADD CONSTRAINT "moments_weekly_competition_id_weekly_competitions_id_fk" FOREIGN KEY ("weekly_competition_id") REFERENCES "public"."weekly_competitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moments" ADD CONSTRAINT "moments_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "moments_member_dedup_idx" ON "moments" USING btree ("clan_member_id","dedup_key");--> statement-breakpoint
CREATE INDEX "moments_weekly_idx" ON "moments" USING btree ("weekly_competition_id","occurred_at");--> statement-breakpoint
CREATE INDEX "moments_event_idx" ON "moments" USING btree ("event_id","occurred_at");--> statement-breakpoint
CREATE INDEX "moments_member_idx" ON "moments" USING btree ("clan_member_id","occurred_at");