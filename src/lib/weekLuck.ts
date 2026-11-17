// This week's luck for a clan: who was spooned and who was dry over the last seven days.
//
// The all-time boards (lib/clogLuckBoard) read a synced collection log against lifetime kills. A week
// has no log to read, so this one is built the way an event's is (lib/eventLuck, lib/eventLuckRules):
// kills are the week's GAINS (the daily rows' per-boss deltas, lib/statHistory) and drops are the
// ones the plugin reported in that window (moments). Two consequences, both shown to the reader:
//
//   - Only members whose plugin reported during the week are judged. Without it we saw none of
//     their drops, and "no drops seen" would read as "dry" about someone we simply didn't watch.
//   - A week is a small sample. The same rule as everywhere decides what is notable (lib/clogProfile
//     assessLuckAt), so a handful of kills with no drop is not "dry"; most weeks the dry side is short.

import { and, eq, gte, inArray, isNull } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, clanMemberships, clanRoster, memberDailyStats, moments } from '@/db/schema';
import { countedLuckCandidates } from '@/lib/clogLuckBoard';
import { clogPageIndex } from '@/lib/clogDataset';
import { buildLuckBoards, type LuckEntry } from '@/lib/clogProfile';
import { countEventDrops, shapeEventLuck } from '@/lib/eventLuckRules';

export const WEEK_LUCK_DAYS = 7;

export interface WeekLuck {
  dry: LuckEntry[];
  spooned: LuckEntry[];
  /** Members whose plugin reported in the window: the only ones a week can judge. */
  judged: number;
  /** Members on the roster. */
  members: number;
}

/** A day's stored per-boss kill gains (`{ bosses: { zulrah: 140 } }`), or nothing when unreadable. */
export function bossGainsOf(raw: string | null | undefined): Record<string, number> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as { bosses?: Record<string, unknown> };
    const out: Record<string, number> = {};
    for (const [key, v] of Object.entries(parsed?.bosses ?? {})) if (typeof v === 'number' && v > 0) out[key] = v;
    return out;
  } catch {
    return {};
  }
}

/** Fold several days' gains into one total per boss. */
export function sumBossGains(days: Record<string, number>[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const d of days) for (const [key, n] of Object.entries(d)) out[key] = (out[key] ?? 0) + n;
  return out;
}

export async function getWeekLuck(clanId: number, limit = 15, now: Date = new Date()): Promise<WeekLuck> {
  const empty: WeekLuck = { dry: [], spooned: [], judged: 0, members: 0 };
  const candidates = await countedLuckCandidates(clanId);
  // Members only, still in the clan: a guest's luck is their own clan's story (as on the all-time boards).
  const roster = await db
    .select({ accountId: clanRoster.accountId, rsn: clanRoster.rsn })
    .from(clanRoster)
    .where(and(eq(clanRoster.clanId, clanId), eq(clanRoster.kind, 'member'), isNull(clanRoster.leftAt)));
  const byAccount = new Map<number, string>();
  for (const r of roster) if (r.accountId != null && !byAccount.has(r.accountId)) byAccount.set(r.accountId, r.rsn);
  const accountIds = [...byAccount.keys()];
  if (accountIds.length === 0 || candidates.length === 0) return { ...empty, members: accountIds.length };

  const start = new Date(now.getTime() - WEEK_LUCK_DAYS * 86_400_000);
  const sinceDay = start.toISOString().slice(0, 10);
  const [dayRows, accountRows, momentRows] = await Promise.all([
    db
      .select({ accountId: memberDailyStats.accountId, deltas: memberDailyStats.deltas })
      .from(memberDailyStats)
      .where(and(gte(memberDailyStats.day, sinceDay), inArray(memberDailyStats.accountId, accountIds))),
    db.select({ id: accounts.id, liveStatsAt: accounts.liveStatsAt }).from(accounts).where(inArray(accounts.id, accountIds)),
    db
      .select({ accountId: clanMemberships.accountId, kind: moments.kind, itemId: moments.itemId, source: moments.source, occurredAt: moments.occurredAt })
      .from(moments)
      .innerJoin(clanMemberships, eq(clanMemberships.id, moments.clanMemberId))
      .where(and(eq(clanMemberships.clanId, clanId), inArray(clanMemberships.accountId, accountIds), gte(moments.occurredAt, sinceDay))),
  ]);

  const gainsBy = new Map<number, Record<string, number>[]>();
  for (const r of dayRows) gainsBy.set(r.accountId, [...(gainsBy.get(r.accountId) ?? []), bossGainsOf(r.deltas)]);
  const participants = accountIds.map((id) => ({ accountId: id, name: byAccount.get(id) ?? '', gains: sumBossGains(gainsBy.get(id) ?? []) }));

  // Judged = the plugin pushed inside the window. occurred_at holds two text formats (lib/dbTime), so
  // the day prefix made the SQL cut and the exact instant is checked here.
  const startMs = start.getTime();
  const at = (s: string | null) => (s ? Date.parse(s.includes('T') ? s : `${s.replace(' ', 'T')}Z`) : NaN);
  const judged = new Set(accountRows.filter((a) => at(a.liveStatsAt) >= startMs).map((a) => a.id));
  const drops = countEventDrops(
    momentRows.filter((m) => at(m.occurredAt) >= startMs),
    candidates,
    clogPageIndex().get('All Pets') ?? new Set<number>(),
  );
  // Rotated by the day, like the all-time boards, so a long week's list isn't the same ten every visit.
  const boards = buildLuckBoards(shapeEventLuck(candidates, participants, drops, judged), limit, now.toISOString().slice(0, 10));
  return { ...boards, judged: judged.size, members: accountIds.length };
}
