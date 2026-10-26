-- Proof provenance + site-drawn stamps (lib/proofStamp). Expand-only: old rows keep NULLs.
CREATE TABLE IF NOT EXISTS "proof_uploads" (
	"url" text PRIMARY KEY NOT NULL,
	"sha256" text NOT NULL,
	"via" text NOT NULL,
	"user_id" integer,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL
);--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN IF NOT EXISTS "source" text;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN IF NOT EXISTS "clean_image_url" text;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN IF NOT EXISTS "image_sha256" text;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN IF NOT EXISTS "proof_facts" text;
