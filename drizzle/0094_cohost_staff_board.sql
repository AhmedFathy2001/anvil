-- A host can let a co-host clan's staff work on the board with them (author tiles from the host's
-- admin). Off by default: on a clan-v-clan board the other side editing tiles is the host's call.
ALTER TABLE "event_cohosts" ADD COLUMN IF NOT EXISTS "staff_can_edit_board" boolean DEFAULT false NOT NULL;
