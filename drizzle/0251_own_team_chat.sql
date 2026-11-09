ALTER TABLE "event_participants" ADD COLUMN IF NOT EXISTS "own_team_chat_only" boolean DEFAULT false NOT NULL;
