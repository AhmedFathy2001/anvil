-- Records (best day / week / month / year gain per account and metric) and the four per-account
-- period baselines they are measured against. Baselines are replaced at rollover, never appended.
CREATE TABLE IF NOT EXISTS "account_records" (
  "id" serial PRIMARY KEY NOT NULL,
  "account_id" integer NOT NULL REFERENCES "accounts"("id") ON DELETE CASCADE,
  "metric" text NOT NULL,
  "period" text NOT NULL,
  "value" double precision NOT NULL,
  "started_at" text NOT NULL,
  "ended_at" text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "account_records_account_metric_period_idx" ON "account_records" ("account_id", "metric", "period");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "account_records_metric_period_value_idx" ON "account_records" ("metric", "period", "value");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "account_period_baselines" (
  "id" serial PRIMARY KEY NOT NULL,
  "account_id" integer NOT NULL REFERENCES "accounts"("id") ON DELETE CASCADE,
  "period" text NOT NULL,
  "period_start" text NOT NULL,
  "values" text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "account_period_baselines_account_period_idx" ON "account_period_baselines" ("account_id", "period");
