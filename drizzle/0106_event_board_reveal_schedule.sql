-- Optional whole-board reveal before play starts. NULL preserves the existing reveal-at-start
-- behavior; the lifecycle tick flips tiles_revealed when this timestamp arrives.
ALTER TABLE "events" ADD COLUMN "tiles_reveal_at" text;
