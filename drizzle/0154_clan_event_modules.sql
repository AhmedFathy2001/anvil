-- Clan event modules: sign-ups (+ host questions), entry fee, payouts, survey — each switched on per event. Expand-only.
ALTER TABLE "clan_events" ADD COLUMN IF NOT EXISTS "modules" jsonb;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "clan_event_questions" (
	"id" serial PRIMARY KEY NOT NULL,
	"clan_id" integer NOT NULL REFERENCES "clans"("id") ON DELETE CASCADE,
	"clan_event_id" integer NOT NULL REFERENCES "clan_events"("id") ON DELETE CASCADE,
	"stage" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"type" text DEFAULT 'text' NOT NULL,
	"prompt" text NOT NULL,
	"options" text,
	"required" boolean DEFAULT false NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "clan_event_questions_event_idx" ON "clan_event_questions" USING btree ("clan_event_id","stage");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "clan_event_signups" (
	"id" serial PRIMARY KEY NOT NULL,
	"clan_id" integer NOT NULL REFERENCES "clans"("id") ON DELETE CASCADE,
	"clan_event_id" integer NOT NULL REFERENCES "clan_events"("id") ON DELETE CASCADE,
	"occurrence" text NOT NULL,
	"user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"clan_member_id" integer REFERENCES "clan_memberships"("id") ON DELETE SET NULL,
	"rsn" text NOT NULL,
	"answers" jsonb,
	"status" text DEFAULT 'approved' NOT NULL,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL,
	"updated_at" text,
	"fee_amount" integer,
	"fee_status" text,
	"collected_by_user_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
	"collected_at" text,
	"proof_url" text,
	"confirmations" jsonb,
	"confirmed_by_user_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
	"confirmed_at" text,
	"fee_notes" text
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "clan_event_signups_unique" ON "clan_event_signups" USING btree ("clan_event_id","occurrence","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "clan_event_signups_clan_idx" ON "clan_event_signups" USING btree ("clan_id");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "clan_event_payouts" (
	"id" serial PRIMARY KEY NOT NULL,
	"clan_id" integer NOT NULL REFERENCES "clans"("id") ON DELETE CASCADE,
	"clan_event_id" integer NOT NULL REFERENCES "clan_events"("id") ON DELETE CASCADE,
	"occurrence" text NOT NULL,
	"rsn" text NOT NULL,
	"amount" integer NOT NULL,
	"note" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"proof_url" text,
	"paid_by_user_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
	"paid_at" text,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "clan_event_payouts_event_idx" ON "clan_event_payouts" USING btree ("clan_event_id","occurrence");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "clan_event_survey_responses" (
	"id" serial PRIMARY KEY NOT NULL,
	"clan_id" integer NOT NULL REFERENCES "clans"("id") ON DELETE CASCADE,
	"clan_event_id" integer NOT NULL REFERENCES "clan_events"("id") ON DELETE CASCADE,
	"occurrence" text NOT NULL,
	"user_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
	"answers" jsonb NOT NULL,
	"submitted_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "clan_event_survey_unique" ON "clan_event_survey_responses" USING btree ("clan_event_id","occurrence","user_id");
