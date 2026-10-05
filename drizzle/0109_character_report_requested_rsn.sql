-- A rename report carries the name the character should take. See schema.ts `characterReports`.
ALTER TABLE "character_reports" ADD COLUMN IF NOT EXISTS "requested_rsn" text;
