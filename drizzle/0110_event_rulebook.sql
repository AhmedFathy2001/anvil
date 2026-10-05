-- The board's own rules (markdown). See schema.ts `events.rulebook`.
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "rulebook" text;
