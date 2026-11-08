-- Clan ownership transfer becomes a REQUEST with a 3-day hold (lib/ownershipTransfers): the owner
-- picks an admin, and the move happens on the lifecycle tick after completes_at unless the owner
-- cancels, the target declines, or Anvil staff block it (/staff/ownership). One pending per clan.
CREATE TABLE IF NOT EXISTS "clan_ownership_transfers" (
	"id" serial PRIMARY KEY NOT NULL,
	"clan_id" integer NOT NULL,
	"from_user_id" integer NOT NULL,
	"to_user_id" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"requested_at" text NOT NULL,
	"completes_at" text NOT NULL,
	"decided_at" text,
	"decided_by_user_id" integer,
	"reason" text,
	"staff_cleared_at" text,
	"staff_cleared_by_user_id" integer,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "clan_ownership_transfers_clan_id_clans_id_fk" FOREIGN KEY ("clan_id") REFERENCES "public"."clans"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "clan_ownership_transfers_from_user_id_users_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "clan_ownership_transfers_to_user_id_users_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "clan_ownership_transfers_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action,
	CONSTRAINT "clan_ownership_transfers_staff_cleared_by_user_id_users_id_fk" FOREIGN KEY ("staff_cleared_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action
);
CREATE UNIQUE INDEX IF NOT EXISTS "clan_ownership_transfers_pending_unique" ON "clan_ownership_transfers" USING btree ("clan_id") WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS "clan_ownership_transfers_status_idx" ON "clan_ownership_transfers" USING btree ("status", "completes_at");
CREATE INDEX IF NOT EXISTS "clan_ownership_transfers_to_user_idx" ON "clan_ownership_transfers" USING btree ("to_user_id");
