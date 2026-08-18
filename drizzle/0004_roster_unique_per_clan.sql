-- Roster uniqueness becomes per-clan.
--
-- These indexes were global because there was one clan per database. Left that way, multi-clan is
-- structurally impossible: the same person legitimately appears on several rosters, and a global
-- unique on rsn_normalized means the second clan cannot add them at all. Found by a test asserting
-- that one RSN is a separate member row in each clan — the insert simply failed.
--
-- The global uniqueness these expressed is real, but it belongs to the ACCOUNT rather than to a
-- membership, and moves to the accounts table when identity splits into person / account /
-- membership. Until then the pair is the honest constraint.
--
-- Safe to run in either order relative to data: the composite is strictly weaker than the global
-- one it replaces, so no existing row can violate it.

DROP INDEX "clan_members_rsn_normalized_unique";--> statement-breakpoint
DROP INDEX "clan_members_account_hash_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "clan_members_clan_rsn_unique" ON "clan_members" USING btree ("clan_id","rsn_normalized");--> statement-breakpoint
CREATE UNIQUE INDEX "clan_members_clan_account_hash_unique" ON "clan_members" USING btree ("clan_id","account_hash");