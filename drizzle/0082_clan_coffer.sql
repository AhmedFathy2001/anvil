-- The clan coffer: one gp ledger per clan.
--
-- Four movements in one table, told apart by `kind` (donation / adjustment / award / refund) and
-- narrowed by `status`. `amount` is SIGNED — donations and refunds positive, awards negative — so
-- the balance is a single SUM (lib/coffer foldBalance) and no cached total can disagree with the
-- history behind it.
--
-- bigint, not integer: 2.1b gp is an ordinary number in this game, and a clan pot that overflows
-- int4 would poison every read on the table the moment somebody seeded it.
CREATE TABLE IF NOT EXISTS "coffer_entries" (
  "id" serial PRIMARY KEY NOT NULL,
  "clan_id" integer NOT NULL REFERENCES "clans"("id") ON DELETE cascade,
  "kind" text NOT NULL,
  "amount" bigint NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "clan_member_id" integer REFERENCES "clan_memberships"("id") ON DELETE set null,
  "rsn" text,
  "created_by_user_id" integer REFERENCES "users"("id") ON DELETE set null,
  "settled_by_user_id" integer REFERENCES "users"("id") ON DELETE set null,
  "settled_at" text,
  "event_id" integer REFERENCES "events"("id") ON DELETE set null,
  "tile_id" integer REFERENCES "tiles"("id") ON DELETE set null,
  "completion_id" integer REFERENCES "completions"("id") ON DELETE cascade,
  "place" integer,
  "proof_blob_url" text,
  "note" text,
  "created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "coffer_entries_clan_idx" ON "coffer_entries" ("clan_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "coffer_entries_clan_status_idx" ON "coffer_entries" ("clan_id","status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "coffer_entries_member_idx" ON "coffer_entries" ("clan_member_id");
--> statement-breakpoint
-- One award per completion: the mission settle pass runs every minute over the same open missions,
-- so the database — not a check-then-write window — is what stops a second prize being minted for a
-- claim that already has one.
CREATE UNIQUE INDEX IF NOT EXISTS "coffer_entries_completion_unique" ON "coffer_entries" ("completion_id") WHERE "completion_id" IS NOT NULL;
