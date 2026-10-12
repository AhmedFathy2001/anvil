import { and, eq, gt, inArray, isNotNull, isNull, lt, ne, notExists, sql } from 'drizzle-orm';
import { db } from '@/db';
import { accounts, hiscoresFetches } from '@/db/schema';
import { normalizeRsn } from '@/lib/auth';
import { parseHiscoresBody, type HiscoresSnapshot, type SnapshotFetch } from '@/lib/hiscores';
import { log } from '@/lib/logger';
import { MAX_RESULT_AGE_MS, nextProbeStep, planForgeApply, toFetchResult, type ProbeMode } from '@/lib/forgeFetchResult';

// The Site's side of the hiscores fetch queue (drizzle/0125, schema hiscoresFetches).
//
// With STATS_SWEEP_OWNER=forge the sweep builds its due list exactly as before and then, instead of
// calling Jagex, comes here: apply what Anvil.Forge fetched since the last drain, queue what is
// still due. Forge only ever fetches what is queued, so it cannot poll anything this app did not
// ask for — and there is no second copy of the sweep's rules anywhere to drift.

/** How long consumed rows are kept for inspection before the drain deletes them. */
const KEEP_CONSUMED_MS = 24 * 60 * 60_000;
/** A pending row older than this means Forge is not fetching. Loud, because nothing is tracking. */
const FORGE_STALL_MS = 15 * 60_000;
/** Applies in flight at once — database work only, so a handful is plenty. */
const APPLY_CONCURRENCY = 4;
/**
 * New account-type probes started per drain. Each walks up to three mode tables at the lowest queue
 * priority, so they only ever spend budget the sweep left idle; this just stops one drain from
 * flooding the queue with the whole backlog of untyped accounts at once.
 */
const PROBES_PER_DRAIN = 8;
/** Queue priority for background probes — behind competition work (0) and roster filler (1). */
const PROBE_PRIORITY = 2;

export interface ForgeWorkEntry {
  fetchRsn: string;
  accountId: number | null;
  rosterOnly: boolean;
}

export interface ForgeDrainStats {
  /** Results taken off the queue this drain. */
  ready: number;
  /** Work entries a result was applied to. */
  applied: number;
  stale: number;
  orphaned: number;
  /** Due entries newly queued for Forge this drain. */
  queued: number;
  /** Requests waiting on Forge after this drain. */
  pending: number;
  /** Age of the oldest waiting request, in seconds. */
  oldestPendingSec: number | null;
  /** Account-type probes: new ones started, steps settled, and of those how many found a mode. */
  probes: { started: number; settled: number; typed: number };
}

export async function drainForgeFetches<E extends ForgeWorkEntry>(opts: {
  work: E[];
  due: E[];
  apply: (entry: E, result: SnapshotFetch, ts: string) => Promise<void>;
}): Promise<ForgeDrainStats> {
  const now = new Date();

  // 1. Take every fetched, unconsumed main-table result. Marking consumed IS the take: a second drain
  //    running at the same moment re-checks `consumed_at IS NULL` after the row lock and gets nothing.
  const rows = await db
    .update(hiscoresFetches)
    .set({ consumedAt: now })
    .where(
      and(
        isNotNull(hiscoresFetches.fetchedAt),
        isNull(hiscoresFetches.consumedAt),
        eq(hiscoresFetches.mode, 'main'),
      ),
    )
    .returning({
      id: hiscoresFetches.id,
      rsnKey: hiscoresFetches.rsnKey,
      outcome: hiscoresFetches.outcome,
      body: hiscoresFetches.body,
      fetchedAt: hiscoresFetches.fetchedAt,
    });

  const plan = planForgeApply(
    rows.map((r) => ({ ...r, fetchedAt: r.fetchedAt! })),
    opts.work,
    normalizeRsn,
    now,
  );
  const bodies = new Map(rows.map((r) => [r.id, r]));

  // 2. Apply. Each entry is independent (its own account and seats), so a few run side by side.
  const pending = [...plan.applies];
  let applied = 0;
  await Promise.all(
    Array.from({ length: APPLY_CONCURRENCY }, async () => {
      while (pending.length > 0) {
        const job = pending.shift();
        if (!job) break;
        const row = bodies.get(job.rowId)!;
        const result = toFetchResult<HiscoresSnapshot>(row, parseHiscoresBody);
        try {
          await opts.apply(job.entry, result, job.fetchedAt.toISOString());
          applied++;
        } catch (e) {
          // One bad entry must not cost the rest of the drain; its account is simply due again.
          log.warn('forge-drain.apply-failed', { rsn: job.entry.fetchRsn, error: (e as Error).message });
        }
      }
    }),
  );

  // 3. Queue what is still due. The partial unique index on (rsn_key, mode) WHERE pending makes
  //    re-queueing an already-waiting name a no-op, so every drain can simply offer the whole list.
  const toQueue = new Map<string, { rsn: string; rsnKey: string; accountId: number | null; priority: number }>();
  for (const entry of opts.due) {
    const rsnKey = normalizeRsn(entry.fetchRsn);
    if (!rsnKey || plan.appliedKeys.has(rsnKey)) continue;
    const priority = entry.rosterOnly ? 1 : 0;
    const prev = toQueue.get(rsnKey);
    if (!prev || priority < prev.priority) {
      toQueue.set(rsnKey, { rsn: entry.fetchRsn, rsnKey, accountId: entry.accountId, priority });
    }
  }
  let queued = 0;
  const values = [...toQueue.values()];
  for (let i = 0; i < values.length; i += 500) {
    const inserted = await db
      .insert(hiscoresFetches)
      .values(values.slice(i, i + 500).map((v) => ({ ...v, mode: 'main' as const })))
      .onConflictDoNothing()
      .returning({ id: hiscoresFetches.id });
    queued += inserted.length;
  }
  // A competition entry already waiting as filler moves up to the competition lane.
  const urgent = values.filter((v) => v.priority === 0).map((v) => v.rsnKey);
  if (urgent.length > 0) {
    await db
      .update(hiscoresFetches)
      .set({ priority: 0 })
      .where(
        and(
          isNull(hiscoresFetches.fetchedAt),
          eq(hiscoresFetches.mode, 'main'),
          sql`${hiscoresFetches.priority} > 0`,
          inArray(hiscoresFetches.rsnKey, urgent),
        ),
      );
  }

  const probes = await advanceTypeProbes(now);

  // 4. Housekeeping: consumed rows only matter for a day of "what did Forge return for X?".
  await db
    .delete(hiscoresFetches)
    .where(
      and(isNotNull(hiscoresFetches.consumedAt), lt(hiscoresFetches.consumedAt, new Date(now.getTime() - KEEP_CONSUMED_MS))),
    );

  const [waiting] = await db
    .select({ n: sql<number>`count(*)::int`, oldest: sql<Date | null>`min(${hiscoresFetches.requestedAt})` })
    .from(hiscoresFetches)
    .where(isNull(hiscoresFetches.fetchedAt));
  const oldest = waiting?.oldest ? new Date(waiting.oldest) : null;
  const oldestPendingSec = oldest ? Math.round((now.getTime() - oldest.getTime()) / 1000) : null;
  if (oldestPendingSec != null && oldestPendingSec * 1000 > FORGE_STALL_MS) {
    // Error, not warn: with Forge owning the sweep, a queue nobody drains means nothing is tracked.
    log.error('forge-drain.stalled', {
      pending: waiting.n,
      oldestPendingSec,
      detail: 'Forge has not fetched queued hiscores requests. Restart Forge, or set STATS_SWEEP_OWNER=site.',
    });
  }

  return {
    ready: rows.length,
    applied,
    stale: plan.stale,
    orphaned: plan.orphaned,
    queued,
    pending: waiting?.n ?? 0,
    oldestPendingSec,
    probes,
  };
}

/**
 * The account-type probe (lib/forgeFetchResult nextProbeStep): settle or advance every probe step
 * Forge has fetched, then start a few new ones. Only for accounts no plugin has reported a mode for,
 * and a settled probe never overwrites a mode the plugin reported in the meantime.
 */
async function advanceTypeProbes(now: Date): Promise<ForgeDrainStats['probes']> {
  let settled = 0;
  let typed = 0;

  const rows = await db
    .update(hiscoresFetches)
    .set({ consumedAt: now })
    .where(
      and(isNotNull(hiscoresFetches.fetchedAt), isNull(hiscoresFetches.consumedAt), ne(hiscoresFetches.mode, 'main')),
    )
    .returning({
      accountId: hiscoresFetches.accountId,
      rsn: hiscoresFetches.rsn,
      rsnKey: hiscoresFetches.rsnKey,
      mode: hiscoresFetches.mode,
      outcome: hiscoresFetches.outcome,
      body: hiscoresFetches.body,
      fetchedAt: hiscoresFetches.fetchedAt,
    });

  const ids = [...new Set(rows.map((r) => r.accountId).filter((id): id is number => id != null))];
  const mainXp = new Map<number, number | null>();
  if (ids.length > 0) {
    // clan-scope: global -- account rows the probe queue already names; identity is global.
    const xs = await db
      .select({ id: accounts.id, xp: accounts.statsOverallXp })
      .from(accounts)
      .where(inArray(accounts.id, ids));
    for (const x of xs) mainXp.set(x.id, x.xp);
  }

  for (const row of rows) {
    if (row.accountId == null || !row.fetchedAt) continue;
    // An old read is compared against today's main-table XP and would look "behind". Drop it; the
    // account is still unprobed, so it is simply started again.
    if (now.getTime() - row.fetchedAt.getTime() > MAX_RESULT_AGE_MS) continue;
    const parsed = toFetchResult<HiscoresSnapshot>(row, parseHiscoresBody);
    const outcome = parsed.kind === 'value' ? 'ok' : parsed.kind;
    const tableXp = parsed.kind === 'value' ? (parsed.snapshot.skills?.overall?.xp ?? null) : null;
    const step = nextProbeStep(row.mode as ProbeMode, outcome, tableXp, mainXp.get(row.accountId) ?? null);

    if (step.kind === 'next') {
      await db
        .insert(hiscoresFetches)
        .values({ rsn: row.rsn, rsnKey: row.rsnKey, mode: step.mode, accountId: row.accountId, priority: PROBE_PRIORITY })
        .onConflictDoNothing();
    } else if (step.kind === 'done') {
      settled++;
      const stamp = now.toISOString();
      // The plugin's report wins: a mode is only written where none is held, and probed_at is stamped
      // either way so the account is not walked again.
      const type = step.type;
      await db
        .update(accounts)
        .set({
          accountTypeProbedAt: stamp,
          ...(type
            ? {
                accountType: sql`COALESCE(${accounts.accountType}, ${type})`,
                accountTypeAt: sql`CASE WHEN ${accounts.accountType} IS NULL THEN ${stamp} ELSE ${accounts.accountTypeAt} END`,
              }
            : {}),
        })
        .where(eq(accounts.id, row.accountId));
      if (type) typed++;
    }
  }

  // Start new probes: active accounts with a main-table reading, no mode, never probed, and no probe
  // step already in flight.
  // clan-scope: global -- game mode belongs to the account, whichever clans hold seats for it.
  const candidates = await db
    .select({ id: accounts.id, rsn: accounts.rsn })
    .from(accounts)
    .where(
      and(
        isNull(accounts.accountType),
        isNull(accounts.accountTypeProbedAt),
        eq(accounts.status, 'active'),
        gt(accounts.statsOverallXp, 0),
        notExists(
          db
            .select({ n: sql`1` })
            .from(hiscoresFetches)
            .where(
              and(
                eq(hiscoresFetches.accountId, accounts.id),
                ne(hiscoresFetches.mode, 'main'),
                isNull(hiscoresFetches.consumedAt),
              ),
            ),
        ),
      ),
    )
    .orderBy(accounts.id)
    .limit(PROBES_PER_DRAIN);
  let started = 0;
  if (candidates.length > 0) {
    const inserted = await db
      .insert(hiscoresFetches)
      .values(
        candidates.map((c) => ({
          rsn: c.rsn,
          rsnKey: normalizeRsn(c.rsn),
          mode: 'ironman' as const,
          accountId: c.id,
          priority: PROBE_PRIORITY,
        })),
      )
      .onConflictDoNothing()
      .returning({ id: hiscoresFetches.id });
    started = inserted.length;
  }
  return { started, settled, typed };
}

/**
 * Drop every request still waiting on Forge. Called when this app owns the sweep, so a queue left
 * over from a Forge period cannot have Forge fetching alongside the in-app sweep.
 */
export async function purgePendingForgeFetches(): Promise<number> {
  const gone = await db
    .delete(hiscoresFetches)
    .where(isNull(hiscoresFetches.fetchedAt))
    .returning({ id: hiscoresFetches.id });
  return gone.length;
}
