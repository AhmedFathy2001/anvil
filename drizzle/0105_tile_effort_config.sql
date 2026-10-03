-- Per-tile assumptions for the board balance auditor. Kept separate from tracking fields: choosing
-- a 400-invocation ToA effort profile must not change which RuneLite loot source completes a tile.
ALTER TABLE "tiles" ADD COLUMN "effort_config" text;
