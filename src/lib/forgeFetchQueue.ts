import { and, eq, gt, inArray, isNotNull, isNull, lt, ne, notExists, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import { accounts, hiscoresFetches } from '@/db/schema';
import { normalizeRsn } from '@/lib/auth';
import { parseHiscoresBody, type HiscoresSnapshot, type SnapshotFetch } from '@/lib/hiscores';
import { log } from '@/lib/logger';
import {
  MAX_RESULT_AGE_MS,
  RECHECK_AFTER_MS,
  nextProbeStep,
  planForgeApply,
  probeStartMode,
  toFetchResult,
  type ProbeMode,
} from '@/lib/forgeFetchResult';

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
/** Queue priority for background probes — behind late joiners (-1, lib/startingStats), competition
 * work (0) and roster filler (1). */
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
  /** Account-type probes: new ones started (first walks + re-checks), settled, and modes written. */
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
 * Forge has fetched, then start a few new ones — first walks for accounts with no mode, and weekly
 * re-checks of solo-iron modes, since a mode goes down (de-ironing, a hardcore death). A settled
 * probe never overwrites a mode the plugin reported while it ran.
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
  const held = new Map<number, { xp: number | null; type: string | null }>();
  if (ids.length > 0) {
    // clan-scope: global -- account rows the probe queue already names; identity is global.
    const xs = await db
      .select({ id: accounts.id, xp: accounts.statsOverallXp, type: accounts.accountType })
      .from(accounts)
      .where(inArray(accounts.id, ids));
    for (const x of xs) held.set(x.id, { xp: x.xp, type: x.type });
  }

  for (const row of rows) {
    if (row.accountId == null || !row.fetchedAt) continue;
    // An old read is compared against today's main-table XP and would look "behind". Drop it; the
    // account is still unprobed, so it is simply started again.
    if (now.getTime() - row.fetchedAt.getTime() > MAX_RESULT_AGE_MS) continue;
    const parsed = toFetchResult<HiscoresSnapshot>(row, parseHiscoresBody);
    const outcome = parsed.kind === 'value' ? 'ok' : parsed.kind;
    const tableXp = parsed.kind === 'value' ? (parsed.snapshot.skills?.overall?.xp ?? null) : null;
    const acc = held.get(row.accountId);
    const step = nextProbeStep(row.mode as ProbeMode, outcome, tableXp, acc?.xp ?? null, acc?.type ?? null);

    if (step.kind === 'next') {
      await db
        .insert(hiscoresFetches)
        .values({ rsn: row.rsn, rsnKey: row.rsnKey, mode: step.mode, accountId: row.accountId, priority: PROBE_PRIORITY })
        .onConflictDoNothing();
    } else if (step.kind === 'done') {
      settled++;
      const stamp = now.toISOString();
      const was = acc?.type ?? null;
      const type = step.type;
      if (type && was == null) {
        // A first walk: write only where no mode is held, so a plugin report that landed meanwhile wins.
        await db
          .update(accounts)
          .set({ accountType: type, accountTypeAt: stamp, accountTypeProbedAt: stamp })
          .where(and(eq(accounts.id, row.accountId), isNull(accounts.accountType)));
        typed++;
      } else if (type && type !== was) {
        // A re-check found the mode went down. Conditional on it still being what we checked, so a
        // plugin report that landed meanwhile is never replaced.
        await db
          .update(accounts)
          .set({ accountType: type, accountTypeAt: stamp, accountTypeProbedAt: stamp })
          .where(and(eq(accounts.id, row.accountId), eq(accounts.accountType, was!)));
        typed++;
      }
      // Stamped either way, so a settled account waits for its next re-check (or, untyped, is done).
      await db.update(accounts).set({ accountTypeProbedAt: stamp }).where(eq(accounts.id, row.accountId));
    }
  }

  // Start new probes: active accounts with a main-table reading and no probe step in flight that
  // either have no mode and were never probed, or hold a solo-iron mode not checked for a week.
  const recheckBefore = new Date(now.getTime() - RECHECK_AFTER_MS).toISOString();
  // clan-scope: global -- game mode belongs to the account, whichever clans hold seats for it.
  const candidates = await db
    .select({ id: accounts.id, rsn: accounts.rsn, type: accounts.accountType })
    .from(accounts)
    .where(
      and(
        or(
          and(isNull(accounts.accountType), isNull(accounts.accountTypeProbedAt)),
          and(
            inArray(accounts.accountType, ['ironman', 'ultimate', 'hardcore']),
            // Whichever is newer — the last report or the last check — must be a week old.
            sql`GREATEST(COALESCE(${accounts.accountTypeProbedAt}, ''), COALESCE(${accounts.accountTypeAt}, '')) < ${recheckBefore}`,
          ),
        ),
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
          mode: probeStartMode(c.type),
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
