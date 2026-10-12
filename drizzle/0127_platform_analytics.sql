-- Platform analytics (lib/analytics, /staff/analytics): page views, feature actions, and one plugin
-- row per (clan, account, day). `name` is a route PATTERN or an action name, never a raw URL, and
-- nothing here identifies a visitor beyond our own user/account ids and a per-tab random session id.
-- Pruned past ~400 days by the hourly errors-digest cron.
CREATE TABLE IF NOT EXISTS "analytics_events" (
  "id" bigserial PRIMARY KEY,
  "ts" text NOT NULL DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS'),
  -- 'page' | 'action' | 'plugin'
  "kind" text NOT NULL,
  "name" text NOT NULL,
  "clan_id" integer REFERENCES "clans"("id") ON DELETE SET NULL,
  "user_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "session_id" text,
  "account_id" integer REFERENCES "accounts"("id") ON DELETE CASCADE,
  "props" jsonb
);

CREATE INDEX IF NOT EXISTS "analytics_events_ts_idx" ON "analytics_events" ("ts");
CREATE INDEX IF NOT EXISTS "analytics_events_kind_name_ts_idx" ON "analytics_events" ("kind", "name", "ts");
CREATE INDEX IF NOT EXISTS "analytics_events_clan_ts_idx" ON "analytics_events" ("clan_id", "ts");
