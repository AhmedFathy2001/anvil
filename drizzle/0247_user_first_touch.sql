-- Where each person first found Anvil: one row per user, written at sign-up (lib/analyticsAttribution).
CREATE TABLE IF NOT EXISTS "user_first_touch" (
  "user_id" integer PRIMARY KEY NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "source" text NOT NULL,
  "medium" text,
  "campaign" text,
  "referrer_host" text,
  "ref" text,
  "created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL
);
CREATE INDEX IF NOT EXISTS "user_first_touch_source_idx" ON "user_first_touch" ("source");
