-- A competition counted over several bosses or skills: each one's starting and current count, beside
-- the sum the standings rank by (lib/weeklyMetric effectiveMetricParts), so a page can show the
-- split. NULL on a single-metric competition and on rows captured before this.
ALTER TABLE "weekly_participants" ADD COLUMN IF NOT EXISTS "baseline_parts" jsonb;--> statement-breakpoint
ALTER TABLE "weekly_participants" ADD COLUMN IF NOT EXISTS "current_parts" jsonb;
