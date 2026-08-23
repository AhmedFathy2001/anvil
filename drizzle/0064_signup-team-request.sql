-- Which team a sign-up ASKED for, on an event where the host takes applications rather than drafting.
-- Approving the sign-up is what actually places them; this only records what they wanted.

ALTER TABLE "event_signups"
  ADD COLUMN IF NOT EXISTS "requested_team_id" integer REFERENCES "teams"("id") ON DELETE set null;
