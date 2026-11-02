-- Game-mode event lines (lib/modeLines): staff patterns and the review queue of unknown lines.
-- 0169 is reserved by feat/multi-proof; this `when` sits after it.
CREATE TABLE IF NOT EXISTS "mode_line_patterns" (
	"id" serial PRIMARY KEY NOT NULL,
	"mode_key" text,
	"kind" text NOT NULL,
	"regex" text NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"note" text,
	"updated_by" integer REFERENCES "users"("id") ON DELETE SET NULL,
	"updated_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mode_line_samples" (
	"id" serial PRIMARY KEY NOT NULL,
	"mode_key" text NOT NULL,
	"template" text NOT NULL,
	"sample" text NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	"auto_posted" boolean DEFAULT false NOT NULL,
	"first_seen" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL,
	"last_seen" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "mode_line_samples_mode_template_unique" ON "mode_line_samples" USING btree ("mode_key","template");
