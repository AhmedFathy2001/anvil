-- Stream overlay (lib/overlay): an unguessable key per event that opens a read-only, chrome-free view
-- of the board for an OBS browser source. Random (192 bits, base64url) and shown back to the host so
-- the dashboard can copy the URL again; "Reset link" replaces it, killing every URL made from the old.
--
-- Its own table rather than a column on "events": whole event rows are read and serialised in many
-- places, and a key on that row would ride along into all of them. No row = no overlay link.
CREATE TABLE IF NOT EXISTS "event_overlays" (
	"event_id" integer PRIMARY KEY NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,
	"key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_overlays_key_unique" UNIQUE("key")
);
