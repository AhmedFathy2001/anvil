-- Plugin tokens, release 1 of the contract half of 0138: new device links are stored by hash only,
-- so the plain column must accept NULL. Nothing is erased here — the slot still running the older
-- code reads a NULL users.plugin_token as "mint a fresh one", which would sign people out mid-switch.
-- The erase (backfill hashes, null the plain values) ships in the NEXT release, once this code is
-- the old slot.
ALTER TABLE "plugin_links" ALTER COLUMN "token" DROP NOT NULL;
