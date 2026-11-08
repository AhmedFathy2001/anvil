// Records — the DB half. Rules (period boundaries, rollover, "beats the best") live in
// lib/recordsRules, which is pure and tested.
//
// Cost on the update path: called from recordDailyStats only when something actually moved, so an
// idle tick does nothing. A moving tick reads the account's four baselines and the stored bests for
// the metrics that moved (two indexed reads), and writes only when a period rolls over (at most four
// rows, once per period) or a best improves.

import { db } from '@/db';
import { accountPeriodBaselines, accountRecords, accounts, clanRoster } from '@/db/schema';
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { HiscoresSnapshot } from '@/lib/hiscores';
import { computeEfficientHours } from '@/lib/efficiency';
import {
  RECORD_PERIODS,
  baselinesToRoll,
  improvements,
  metricValues,
  movedMetrics,
  periodGains,
  recordKey,
  type Baseline,
  type MetricValues,
  type RecordCandidate,
  type RecordPeriod,
} from '@/lib/recordsRules';
import { log } from '@/lib/logger';

function parseValues(json: string): MetricValues {
  try {
    const v = JSON.parse(json);
    return v && typeof v === 'object' ? (v as MetricValues) : {};
  } catch {
    return {};
  }
}

const hoursOf = (s: HiscoresSnapshot | null) => {
  if (!s?.skills || !s.bosses) return null;
  const h = computeEfficientHours(s);
  return { played: h.ehp, bossed: h.ehb };
};

export interface RecordsUpdateInput {
  accountId: number;
  snapshot: HiscoresSnapshot;
  previous: HiscoresSnapshot | null;
  now?: Date;
}

/** Fold one stat update into the account's baselines and records. Never throws. */
export async function updateRecords(input: RecordsUpdateInput): Promise<{ rolled: number; improved: number }> {
  try {
    return await updateRecordsInner(input);
  } catch (err) {
    log.warn('records.update_failed', { accountId: input.accountId, error: String(err) });
    return { rolled: 0, improved: 0 };
  }
}

async function updateRecordsInner(input: RecordsUpdateInput): Promise<{ rolled: number; improved: number }> {
  const now = input.now ?? new Date();
  const nowIso = now.toISOString();
  const current = metricValues(input.snapshot, hoursOf(input.snapshot));
  const previous = metricValues(input.previous, hoursOf(input.previous));

  const rows = await db
    .select({ period: accountPeriodBaselines.period, periodStart: accountPeriodBaselines.periodStart, values: accountPeriodBaselines.values })
    .from(accountPeriodBaselines)
    .where(eq(accountPeriodBaselines.accountId, input.accountId));
  const existing: Baseline[] = rows.map((r) => ({
    period: r.period as RecordPeriod,
    periodStart: r.periodStart,
    values: parseValues(r.values),
  }));

  const rolled = baselinesToRoll(existing, previous, current, now);
  for (const b of rolled) {
    await db
      .insert(accountPeriodBaselines)
      .values({ accountId: input.accountId, period: b.period, periodStart: b.periodStart, values: JSON.stringify(b.values) })
      .onConflictDoUpdate({
        target: [accountPeriodBaselines.accountId, accountPeriodBaselines.period],
        set: { periodStart: b.periodStart, values: JSON.stringify(b.values) },
      });
  }
  const baselines = new Map(existing.map((b) => [b.period, b]));
  for (const b of rolled) baselines.set(b.period, b);

  const moved = movedMetrics(previous, current);
  if (moved.length === 0) return { rolled: rolled.length, improved: 0 };

  const candidates: RecordCandidate[] = [];
  for (const period of RECORD_PERIODS) {
    const b = baselines.get(period);
    if (!b) continue;
    for (const [metric, value] of Object.entries(periodGains(b.values, current, moved))) {
      candidates.push({ metric, period, value, startedAt: b.periodStart });
    }
  }
  if (candidates.length === 0) return { rolled: rolled.length, improved: 0 };

  const bestRows = await db
    .select({ metric: accountRecords.metric, period: accountRecords.period, value: accountRecords.value })
    .from(accountRecords)
    .where(and(eq(accountRecords.accountId, input.accountId), inArray(accountRecords.metric, [...new Set(candidates.map((c) => c.metric))])));
  const best = new Map(bestRows.map((r) => [recordKey(r.metric, r.period as RecordPeriod), r.value]));
  const better = improvements(candidates, best);
  if (better.length === 0) return { rolled: rolled.length, improved: 0 };

  await db
    .insert(accountRecords)
    .values(better.map((c) => ({ accountId: input.accountId, metric: c.metric, period: c.period, value: c.value, startedAt: c.startedAt, endedAt: nowIso })))
    .onConflictDoUpdate({
      target: [accountRecords.accountId, accountRecords.metric, accountRecords.period],
      set: {
        value: sql`excluded.value`,
        startedAt: sql`excluded.started_at`,
        endedAt: sql`excluded.ended_at`,
      },
      // Two overlapping updates (sweep + push) can race; the higher value always wins.
      setWhere: sql`excluded.value > ${accountRecords.value}`,
    });
  return { rolled: rolled.length, improved: better.length };
}

// ── Reads ────────────────────────────────────────────────────────────────────────────────────────

export interface AccountRecord {
  metric: string;
  period: RecordPeriod;
  value: number;
  startedAt: string;
  endedAt: string;
}

/** Every record an account holds. At most (metrics × 4) small rows. */
export async function getAccountRecords(accountId: number): Promise<AccountRecord[]> {
  const rows = await db
    .select({
      metric: accountRecords.metric,
      period: accountRecords.period,
      value: accountRecords.value,
      startedAt: accountRecords.startedAt,
      endedAt: accountRecords.endedAt,
    })
    .from(accountRecords)
    .where(eq(accountRecords.accountId, accountId));
  return rows.map((r) => ({ ...r, period: r.period as RecordPeriod }));
}

export interface ClanRecordHolder extends AccountRecord {
  accountId: number;
  rsn: string;
}

/**
 * The clan's record holder for each metric in one period: the single best gain among the clan's
 * current roster accounts.
 */
export async function getClanRecordHolders(clanId: number, period: RecordPeriod): Promise<ClanRecordHolder[]> {
  const rows = await db
    .selectDistinctOn([accountRecords.metric], {
      metric: accountRecords.metric,
      period: accountRecords.period,
      value: accountRecords.value,
      startedAt: accountRecords.startedAt,
      endedAt: accountRecords.endedAt,
      accountId: accountRecords.accountId,
      rsn: accounts.rsn,
    })
    .from(accountRecords)
    .innerJoin(accounts, eq(accounts.id, accountRecords.accountId))
    .where(and(eq(accountRecords.period, period), inArray(accountRecords.accountId, clanMemberAccounts(clanId))))
    .orderBy(accountRecords.metric, desc(accountRecords.value), accountRecords.endedAt);
  return rows.map((r) => ({ ...r, period: r.period as RecordPeriod }));
}

/** Current members' accounts (not guests, not leavers). */
const clanMemberAccounts = (clanId: number) =>
  db
    .select({ id: clanRoster.accountId })
    .from(clanRoster)
    .where(and(eq(clanRoster.clanId, clanId), eq(clanRoster.kind, 'member'), isNull(clanRoster.leftAt)));

/** Top N accounts in a clan for one metric and period. */
export async function getClanRecordBoard(clanId: number, metric: string, period: RecordPeriod, limit = 10) {
  return db
    .select({ accountId: accountRecords.accountId, rsn: accounts.rsn, value: accountRecords.value, startedAt: accountRecords.startedAt, endedAt: accountRecords.endedAt })
    .from(accountRecords)
    .innerJoin(accounts, eq(accounts.id, accountRecords.accountId))
    .where(
      and(
        eq(accountRecords.metric, metric),
        eq(accountRecords.period, period),
        inArray(accountRecords.accountId, clanMemberAccounts(clanId)),
      ),
    )
    .orderBy(desc(accountRecords.value))
    .limit(Math.min(Math.max(limit, 1), 50));
}
