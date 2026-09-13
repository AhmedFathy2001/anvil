-- "Can I play this event on my other account?"
--
-- The repoint already existed on both sides — a host admin from the sign-ups tab, a delegated
-- team's staff from their team page. What did not exist was a way for the PLAYER to ask, so the
-- asking happened in Discord where it competed with everything else in the channel, and the answer
-- was somebody remembering to go and do it. On a paid board with a scoring baseline attached to the
-- character, forgetting is expensive.
--
-- A request, not a change: approving calls the same repoint the approver could already have done by
-- hand. This grants no authority — it gives the asking a queue, a record, and somewhere to be seen.
CREATE TABLE IF NOT EXISTS "account_change_requests" (
  "id" serial PRIMARY KEY NOT NULL,
  "event_id" integer NOT NULL REFERENCES "events"("id") ON DELETE cascade,
  "participant_id" integer NOT NULL REFERENCES "event_participants"("id") ON DELETE cascade,
  "requested_by_user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "to_clan_member_id" integer NOT NULL REFERENCES "clan_memberships"("id") ON DELETE cascade,
  "from_clan_member_id" integer REFERENCES "clan_memberships"("id") ON DELETE set null,
  "status" text DEFAULT 'pending' NOT NULL,
  "note" text,
  "decided_by_user_id" integer REFERENCES "users"("id") ON DELETE set null,
  "decided_at" text,
  "decision_note" text,
  "created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL
);
--> statement-breakpoint
-- One OPEN ask per roster row. Asking twice is the same ask, and a queue holding two contradictory
-- pending requests for one player is one somebody has to reconcile by hand.
CREATE UNIQUE INDEX IF NOT EXISTS "account_change_one_open"
  ON "account_change_requests" ("participant_id") WHERE status = 'pending';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "account_change_event_status_idx"
  ON "account_change_requests" ("event_id","status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "account_change_requester_idx"
  ON "account_change_requests" ("requested_by_user_id");
