-- Per-placement prize percentages, as JSON, so a host can pay 60/30/10 instead of winner-takes-all.

ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "placement_split_pct" text;
