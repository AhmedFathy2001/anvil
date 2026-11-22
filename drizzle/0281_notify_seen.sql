-- One collection-log slot, one post, across restarts: the last time each person posted each slot.
CREATE TABLE IF NOT EXISTS "notify_seen" (
  "key" text PRIMARY KEY NOT NULL,
  "seen_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "notify_seen_at_idx" ON "notify_seen" ("seen_at");
