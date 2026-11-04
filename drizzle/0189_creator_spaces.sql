-- Creator spaces: a streamer's home for hosting events with no in-game OSRS clan behind it.
-- 'clan' (every existing row, and the default) | 'creator'. IF NOT EXISTS so a re-run is harmless.
ALTER TABLE "clans" ADD COLUMN IF NOT EXISTS "kind" text DEFAULT 'clan' NOT NULL;
-- A join request can be for ONE event: a creator space approves each `approval` event on its own,
-- so a seat won through one event never admits somebody to another. Null = a clan-wide request,
-- which is every request from before this migration.
ALTER TABLE "clan_join_requests" ADD COLUMN IF NOT EXISTS "event_id" integer REFERENCES "events"("id") ON DELETE CASCADE;
-- One live request per account per clan PER EVENT (clan-wide counted as its own slot).
DROP INDEX IF EXISTS "clan_join_requests_pending_unique";
CREATE UNIQUE INDEX IF NOT EXISTS "clan_join_requests_pending_unique" ON "clan_join_requests" USING btree ("clan_id","account_id",coalesce("event_id", 0)) WHERE status = 'pending';
