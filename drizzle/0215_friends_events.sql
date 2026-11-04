-- FRIENDS EVENTS (lib/friendEvents, lib/friendEventRules): a Supporter hosts small private events for
-- friends from a HIDDEN per-person host — a `clans` row of kind 'friends' (platform-hidden,
-- members-only, no in-game name), made on first use. Its events are invite-only: the link carries an
-- unguessable token, and pressing it records an ordinary event_invites row.
--
--   clans.friends_owner_user_id  the friends host's one owner (whose Supporter tier caps it); unique
--   events.invite_token          a friends event's invite link token; unique
--
-- Additive and nullable: every existing row keeps its meaning. `kind` is plain text, so 'friends'
-- needs no constraint change (its plan stays 'free', which clans_plan_matches_kind allows).

ALTER TABLE "clans" ADD COLUMN IF NOT EXISTS "friends_owner_user_id" integer;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "clans" ADD CONSTRAINT "clans_friends_owner_user_id_users_id_fk"
    FOREIGN KEY ("friends_owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "clans_friends_owner_unique" ON "clans" USING btree ("friends_owner_user_id") WHERE friends_owner_user_id is not null;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "invite_token" text;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "events_invite_token_unique" ON "events" USING btree ("invite_token") WHERE invite_token is not null;
