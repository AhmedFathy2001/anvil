-- The hiscores fetch queue: this app decides WHO to poll, Anvil.Forge fetches them, this app applies
-- what came back (lib/statsSweep, source 'forge'). Forge never interprets a result; it stores the
-- official endpoint's raw JSON body so the one parser that matters (lib/hiscores) reads it.
--
-- One row per request. A row is PENDING until fetched_at is set, READY until consumed_at is set, and
-- then kept briefly for inspection before the sweep deletes it.
CREATE TABLE IF NOT EXISTS "hiscores_fetches" (
  "id" bigserial PRIMARY KEY,
  "rsn" text NOT NULL,
  -- normalizeRsn(rsn): what dedupes a request and matches a result back to its work entry.
  "rsn_key" text NOT NULL,
  -- 'main' | 'ironman' | 'hardcore' | 'ultimate' — which hiscores table to read.
  "mode" text NOT NULL DEFAULT 'main',
  "account_id" integer,
  -- 0 = a competition is waiting on it, 1 = roster filler, 2 = background probes. Lower goes first.
  "priority" smallint NOT NULL DEFAULT 1,
  "requested_at" timestamptz NOT NULL DEFAULT now(),
  -- Forge's lease. A crashed worker's rows come back after its lease elapses.
  "claimed_at" timestamptz,
  "fetched_at" timestamptz,
  -- 'ok' | 'unranked' | 'transient'
  "outcome" text,
  -- The raw index_lite.json body, set only when outcome = 'ok'.
  "body" text,
  "error" text,
  "consumed_at" timestamptz
);

-- At most one pending request per name and table, so re-queueing every tick is free.
CREATE UNIQUE INDEX IF NOT EXISTS "hiscores_fetches_pending_uq"
  ON "hiscores_fetches" ("rsn_key", "mode") WHERE "fetched_at" IS NULL;
-- Forge's claim order.
CREATE INDEX IF NOT EXISTS "hiscores_fetches_claim_idx"
  ON "hiscores_fetches" ("priority", "requested_at") WHERE "fetched_at" IS NULL;
-- The Site's drain.
CREATE INDEX IF NOT EXISTS "hiscores_fetches_ready_idx"
  ON "hiscores_fetches" ("fetched_at") WHERE "fetched_at" IS NOT NULL AND "consumed_at" IS NULL;

-- Forge's tick log, for observability only (nothing here reads it to decide anything). Created here
-- so production has it without running Forge's own migration chain by hand.
CREATE TABLE IF NOT EXISTS "forge_sweep_runs" (
  "id" bigserial PRIMARY KEY,
  "started_at" timestamptz NOT NULL DEFAULT now(),
  "finished_at" timestamptz,
  "claimed" integer NOT NULL DEFAULT 0,
  "fetched" integer NOT NULL DEFAULT 0,
  "changed" integer NOT NULL DEFAULT 0,
  "unranked" integer NOT NULL DEFAULT 0,
  "errors" integer NOT NULL DEFAULT 0,
  "backlog" integer NOT NULL DEFAULT 0,
  "shadow" boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS "forge_sweep_runs_started_idx" ON "forge_sweep_runs" ("started_at" DESC);
