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
