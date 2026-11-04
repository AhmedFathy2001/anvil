-- The public events directory (anvilosrs.com/events, lib/eventsDirectoryDb) reads every advertised
-- event across the platform. `events.advertised` already exists (0096, the per-event "Advertise on
-- Anvil" switch); this is the index that keeps that read cheap. Partial, so it only ever holds the
-- handful of advertised rows rather than every board ever made.
CREATE INDEX IF NOT EXISTS "events_advertised_start_idx" ON "events" USING btree ("start_date") WHERE "advertised" = true;
