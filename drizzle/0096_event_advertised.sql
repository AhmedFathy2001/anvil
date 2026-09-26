-- A host asks for a public board to be shown on the apex home's "Open to everyone" feed. Separate from
-- visibility (readable by link is not the same as advertised); off by default.
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "advertised" boolean DEFAULT false NOT NULL;
