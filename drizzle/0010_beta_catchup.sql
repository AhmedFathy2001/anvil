-- What beta added while this branch was being built, in Postgres.
--
-- Four migrations arrived with the merge — start-proof position checks, CA moments, team invites and
-- member progress — all written in SQLite, against a `clan_members` table this branch has already
-- retired. They cannot run here, so they are deleted and their intent expressed once, correctly:
--
--   * `mode: 'boolean'` on an integer is a SQLite idiom; Postgres has the type.
--   * member_progress hangs off a roster SEAT, which is clan_memberships now.
--   * `datetime('now')` is not a Postgres function.
--
-- Nothing else about them changes. This is the same schema, said in the right language.

-- ── Start-proof position and session checks ────────────────────────────────────────────────
ALTER TABLE "event_start_proofs" ADD COLUMN "x" integer;--> statement-breakpoint
ALTER TABLE "event_start_proofs" ADD COLUMN "y" integer;--> statement-breakpoint
ALTER TABLE "event_start_proofs" ADD COLUMN "distance" integer;--> statement-breakpoint
ALTER TABLE "event_start_proofs" ADD COLUMN "position_ok" boolean;--> statement-breakpoint
ALTER TABLE "event_start_proofs" ADD COLUMN "login_at" text;--> statement-breakpoint
ALTER TABLE "event_start_proofs" ADD COLUMN "session_minutes" integer;--> statement-breakpoint
ALTER TABLE "event_start_proofs" ADD COLUMN "session_ok" boolean;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "start_proof_x" integer;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "start_proof_y" integer;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "start_proof_radius" integer;--> statement-breakpoint

-- ── Combat tasks in the feed and the recap ─────────────────────────────────────────────────
ALTER TABLE "moments" ADD COLUMN "tier" text;--> statement-breakpoint
ALTER TABLE "event_participants" ADD COLUMN "ca_tasks" integer DEFAULT 0;--> statement-breakpoint

-- ── One-team invite links ──────────────────────────────────────────────────────────────────
CREATE TABLE "team_invites" (
	"id" serial PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"team_id" integer NOT NULL,
	"event_id" integer NOT NULL,
	"max_uses" integer,
	"uses" integer DEFAULT 0 NOT NULL,
	"expires_at" text,
	"revoked_at" text,
	"created_by_user_id" integer,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL
);--> statement-breakpoint
ALTER TABLE "team_invites" ADD CONSTRAINT "team_invites_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_invites" ADD CONSTRAINT "team_invites_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_invites" ADD CONSTRAINT "team_invites_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "team_invite_token_unique" ON "team_invites" USING btree ("token");--> statement-breakpoint
CREATE INDEX "team_invite_team_idx" ON "team_invites" USING btree ("team_id");--> statement-breakpoint

-- ── Account progress the hiscores don't publish ────────────────────────────────────────────
--
-- Keyed on the roster SEAT, which is a clan_memberships row here rather than the clan_members one
-- beta wrote against.
CREATE TABLE "member_progress" (
	"id" serial PRIMARY KEY NOT NULL,
	"clan_member_id" integer NOT NULL,
	"key" text NOT NULL,
	"value" integer NOT NULL,
	"updated_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL
);--> statement-breakpoint
ALTER TABLE "member_progress" ADD CONSTRAINT "member_progress_clan_member_id_clan_memberships_id_fk" FOREIGN KEY ("clan_member_id") REFERENCES "public"."clan_memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "member_progress_member_key_unique" ON "member_progress" USING btree ("clan_member_id","key");--> statement-breakpoint
CREATE INDEX "member_progress_key_idx" ON "member_progress" USING btree ("key");
