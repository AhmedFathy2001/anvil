-- A separate-save world's activity gets a quiet, opt-in timeline in the plugin Feed. Keeping the
-- mode on the existing moment row preserves reactions and the established row presentation while
-- letting every normal feed exclude it explicitly.
ALTER TABLE "moments" ADD COLUMN IF NOT EXISTS "world_mode" text;
ALTER TABLE "moments" ADD COLUMN IF NOT EXISTS "world_mode_label" text;
CREATE INDEX IF NOT EXISTS "moments_world_mode_idx" ON "moments" ("world_mode", "occurred_at");
