-- Who may see an event, and who may enter it.
--
-- Every event has been its clan's alone, which was the only thing one-clan-per-deployment could
-- express. Clan-versus-clan is the point of putting clans on one platform, and it needs two
-- questions answered separately, because they are different questions:
--
--   visibility — may someone outside this clan SEE it?
--   entry      — may they JOIN, and does somebody have to say yes?
--
-- A public event with approval is the ordinary cross-clan case: anyone can look, the host decides
-- who plays. A public event with open entry is a free-for-all, which some hosts want and most do
-- not. An invited event is the clan-versus-clan primitive: two clans agree, and nobody else appears.

ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "visibility" text DEFAULT 'clan' NOT NULL;
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "entry" text DEFAULT 'open' NOT NULL;

-- Defaults preserve exactly what every existing event already is: its clan's, and anyone in that
-- clan may sign up. Nothing changes for a board that is running right now.

CREATE INDEX IF NOT EXISTS "events_visibility_idx" ON "events" ("visibility");

-- ── Invitations ──────────────────────────────────────────────────────────────────────────────
--
-- Addressable to a whole CLAN or one PERSON. The clan form is what makes clan-versus-clan work
-- without listing forty names, and the person form covers a ringer, a guest caller, a friend.
--
-- Exactly one of the two is set — a row naming both would be ambiguous about what was invited, and
-- a row naming neither invites nobody.
CREATE TABLE IF NOT EXISTS "event_invites" (
  "id" serial PRIMARY KEY NOT NULL,
  "event_id" integer NOT NULL REFERENCES "events"("id") ON DELETE cascade,
  "clan_id" integer REFERENCES "clans"("id") ON DELETE cascade,
  "player_id" integer REFERENCES "players"("id") ON DELETE cascade,
  "invited_by_user_id" integer REFERENCES "users"("id") ON DELETE set null,
  "invited_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL,
  "note" text,
  CONSTRAINT "event_invites_one_target" CHECK (
    ("clan_id" IS NOT NULL AND "player_id" IS NULL) OR
    ("clan_id" IS NULL AND "player_id" IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS "event_invites_clan_unique"
  ON "event_invites" ("event_id", "clan_id") WHERE "clan_id" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "event_invites_player_unique"
  ON "event_invites" ("event_id", "player_id") WHERE "player_id" IS NOT NULL;
