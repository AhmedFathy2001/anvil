-- On-demand hiscores lookups for RSNs with no Anvil account (lib/publicHiscoresCard): the plugin's
-- Lookup card for a stranger. 'value' rows are fresh for 30 minutes, 'unranked' for 24 hours;
-- transient failures are never stored.
CREATE TABLE IF NOT EXISTS "public_hiscores_cache" (
	"rsn_key" text PRIMARY KEY NOT NULL,
	"rsn" text NOT NULL,
	"outcome" text NOT NULL,
	"body" text,
	"fetched_at" text NOT NULL
);
