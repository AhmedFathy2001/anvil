-- Guide proposals: anyone signed in can write a guide, or suggest an edit to an Anvil library guide,
-- for a platform guide editor to approve. See `guide_proposals` in db/schema.ts.
CREATE TABLE IF NOT EXISTS "guide_proposals" (
  "id" serial PRIMARY KEY NOT NULL,
  "proposer_user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "target_guide_id" integer REFERENCES "guides"("id") ON DELETE set null,
  "base_version" integer,
  "title" text NOT NULL,
  "summary" text DEFAULT '' NOT NULL,
  "category" text DEFAULT 'general' NOT NULL,
  "cover_url" text,
  "body" text DEFAULT '' NOT NULL,
  "note" text,
  "status" text DEFAULT 'pending' NOT NULL,
  "review_note" text,
  "reviewed_by_user_id" integer REFERENCES "users"("id") ON DELETE set null,
  "result_guide_id" integer REFERENCES "guides"("id") ON DELETE set null,
  "created_at" text NOT NULL,
  "updated_at" text NOT NULL,
  "reviewed_at" text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "guide_proposals_status_idx" ON "guide_proposals" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "guide_proposals_proposer_idx" ON "guide_proposals" ("proposer_user_id");
