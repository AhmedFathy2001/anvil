-- An operator borrowing a clan's authority, for a while, on the record.
--
-- Platform staff get no clan write from being platform staff — that separation is the point of the
-- two axes. This is the explicit, expiring exception, so that "an operator had to fix something"
-- never becomes "operators quietly hold admin everywhere".
--
-- expires_at is NOT NULL on purpose: a grant with no end is the thing this table exists to prevent.

CREATE TABLE IF NOT EXISTS "platform_act_as" (
  "id" serial PRIMARY KEY NOT NULL,
  "clan_id" integer NOT NULL REFERENCES "clans"("id") ON DELETE cascade,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "role" text DEFAULT 'admin' NOT NULL,
  "reason" text NOT NULL,
  "granted_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL,
  "expires_at" text NOT NULL,
  "revoked_at" text
);

-- The hot path is "does this operator hold a live grant in this clan", asked on every request that
-- resolves authority, so it is one index covering exactly that question.
CREATE INDEX IF NOT EXISTS "platform_act_as_lookup_idx"
  ON "platform_act_as" ("user_id", "clan_id", "expires_at");
