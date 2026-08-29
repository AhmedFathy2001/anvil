-- Forge's player-events outbox, mirrored into the Site's migration chain.
--
-- Forge (the Go data plane) fetches hiscores, writes the result into the `accounts` columns this app
-- already reads, and appends a line here when a snapshot moves. Forge INGESTS; it never EVALUATES —
-- whether a gain completed a tile / crossed a milestone / moved a weekly value is a domain question
-- this app answers in lib/forgeConsume, which drains the unconsumed tail and stamps consumed_at.
--
-- IF NOT EXISTS throughout so this coexists with Forge's own migrations/0001_init.sql against the ONE
-- shared Postgres: whichever process migrates first creates the table, the other's create is a no-op.
-- The inline FK auto-names to forge_player_events_account_id_fkey — identical to Forge's — so a table
-- that already exists is skipped whole rather than growing a second constraint. The Site's test DB,
-- built from this chain, gets the table so the consumer is testable without Forge running.
CREATE TABLE IF NOT EXISTS "forge_player_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"account_id" integer NOT NULL REFERENCES "accounts"("id") ON DELETE CASCADE,
	"kind" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"consumed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forge_player_events_unconsumed_idx" ON "forge_player_events" ("id") WHERE "consumed_at" IS NULL;
