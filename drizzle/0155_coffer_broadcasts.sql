-- Clan coffer: the clan-chat line ("X has deposited N coins into the coffer.") as reported by each plugin that saw it. Expand-only.
CREATE TABLE IF NOT EXISTS "clan_coffer_broadcasts" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"clan_id" integer NOT NULL REFERENCES "clans"("id") ON DELETE CASCADE,
	"actor_rsn" text NOT NULL,
	"actor_key" text NOT NULL,
	"direction" text NOT NULL,
	"amount" bigint NOT NULL,
	"reporters" integer[] DEFAULT '{}'::integer[] NOT NULL,
	"reporter_seats" integer[] DEFAULT '{}'::integer[] NOT NULL,
	"coffer_entry_id" integer REFERENCES "coffer_entries"("id") ON DELETE SET NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "clan_coffer_broadcasts_match_idx" ON "clan_coffer_broadcasts" USING btree ("clan_id","actor_key","created_at");
