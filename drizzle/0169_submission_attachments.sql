CREATE TABLE IF NOT EXISTS "submission_attachments" (
	"id" serial PRIMARY KEY NOT NULL,
	"submission_id" integer REFERENCES "submissions"("id") ON DELETE cascade,
	"tile_id" integer NOT NULL REFERENCES "tiles"("id") ON DELETE cascade,
	"team_id" integer NOT NULL REFERENCES "teams"("id") ON DELETE cascade,
	"user_id" integer REFERENCES "users"("id") ON DELETE set null,
	"kind" text NOT NULL,
	"url" text NOT NULL,
	"label" text,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "submission_attachments_submission_idx" ON "submission_attachments" USING btree ("submission_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "submission_attachments_draft_idx" ON "submission_attachments" USING btree ("tile_id","team_id","user_id");
--> statement-breakpoint
ALTER TABLE "proof_uploads" ADD COLUMN IF NOT EXISTS "event_id" integer REFERENCES "events"("id") ON DELETE set null;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "proof_uploads_event_idx" ON "proof_uploads" USING btree ("event_id");
--> statement-breakpoint
-- Backfill: a file already filed on exactly one event belongs to it. A file named by two events stays
-- unclaimed, so the purge never deletes it.
UPDATE "proof_uploads" pu SET "event_id" = x.event_id
FROM (
  SELECT url, min(event_id) AS event_id FROM (
    SELECT s.image_url AS url, t.event_id FROM submissions s JOIN tiles t ON t.id = s.tile_id WHERE s.image_url IS NOT NULL
    UNION ALL
    SELECT s.clean_image_url, t.event_id FROM submissions s JOIN tiles t ON t.id = s.tile_id WHERE s.clean_image_url IS NOT NULL
    UNION ALL
    SELECT sp.image_url, sp.event_id FROM event_start_proofs sp
  ) refs
  GROUP BY url
  HAVING count(DISTINCT event_id) = 1
) x
WHERE pu.url = x.url AND pu.event_id IS NULL;
