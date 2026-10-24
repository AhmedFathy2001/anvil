-- Tile lab (lib/lab): staff test any tile kind against a real account without a real bingo. Additive
-- only — three new tables, nothing existing changes, so a blue-green rollback is unaffected.
CREATE TABLE IF NOT EXISTS "lab_log" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "event_id" integer NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,
  "account_id" integer REFERENCES "accounts"("id") ON DELETE SET NULL,
  "endpoint" text NOT NULL,
  "payload" jsonb,
  "created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lab_log_event_idx" ON "lab_log" ("event_id", "id");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lab_scenarios" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  "params" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "updated_by" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "updated_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "lab_scenarios_name_unique" ON "lab_scenarios" ("name");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chat_pattern_overrides" (
  "key" text PRIMARY KEY NOT NULL,
  "regex" text NOT NULL,
  "hint" text,
  "note" text,
  "updated_by" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "updated_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL
);
