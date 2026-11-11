// Yearly Wrapped: the month card's numbers over a whole year (lib/monthlyWrapped with key 'YYYY'),
// plus what only a year has — the events they played, their busiest month, and since when we've
// been counting.

import { and, eq, like, sql } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, clans, eventParticipants, events, memberDailyStats, users } from '@/db/schema';
import { yearStreak } from '@/lib/activityStreaks';
import { supporterLooksByName } from '@/lib/supporter';
import { giftedMonthsInYear } from '@/lib/supporterGiftCheckout';
import { giverRank } from '@/lib/supporterGiftPurchase';
import { SUPPORTER_TIERS, TENURE_LADDER } from '@/lib/supporterTiers';
import { getEventWrapped } from '@/lib/eventWrapped';
import { visibilityOf } from '@/lib/eventVisibility';
import { getMonthlyWrapped } from '@/lib/monthlyWrapped';
import type { YearEvent, YearlyWrapped } from '@/lib/yearlyWrappedRules';
import { isEventEnded } from '@/lib/survey';
import { notLabClan } from '@/lib/lab';

export async function getYearlyWrapped(accountId: number, rsn: string, year: string): Promise<YearlyWrapped> {
  const [base, firstDay, busiest, events, streak, extras] = await Promise.all([
    getMonthlyWrapped(accountId, rsn, year),
    db
      .select({ day: sql<string | null>`min(${memberDailyStats.day})` })
      .from(memberDailyStats)
      .where(and(eq(memberDailyStats.accountId, accountId), like(memberDailyStats.day, `${year}-%`))),
    db
      .select({ month: sql<string>`substr(${memberDailyStats.day}, 1, 7)`, xp: sql<number>`sum(${memberDailyStats.xpGained})` })
      .from(memberDailyStats)
      .where(and(eq(memberDailyStats.accountId, accountId), like(memberDailyStats.day, `${year}-%`)))
      .groupBy(sql`substr(${memberDailyStats.day}, 1, 7)`)
      .orderBy(sql`sum(${memberDailyStats.xpGained}) desc`)
      .limit(1),
    yearEvents(accountId, year),
    yearStreak(accountId, year).catch(() => null),
    supporterExtras(accountId, rsn, year).catch(() => ({ supporter: null, gifted: null })),
  ]);
  const since = firstDay[0]?.day ?? null;
  return {
    ...base,
    trackedSince: since && since > `${year}-01-01` ? since : null,
    busiestMonth: busiest[0] && Number(busiest[0].xp) > 0 ? { key: busiest[0].month, xp: Number(busiest[0].xp) } : null,
    events,
    streak: streak && streak.best > 0 ? streak : null,
    ...extras,
  };
}

/**
 * The Supporter bits of a year: the star this character wears publicly (supporterLooksByName applies
 * the same shared + verified rule as every name), and the months its person gave others, only when
 * they're on the public wall (users.supporter_wall on every login).
 */
async function supporterExtras(accountId: number, rsn: string, year: string): Promise<Pick<YearlyWrapped, 'supporter' | 'gifted'>> {
  const look = (await supporterLooksByName([rsn]))[rsn];
  const supporter = look?.tenure
    ? {
        tier: look.tier,
        tierName: SUPPORTER_TIERS[look.tier].name,
        tenure: look.tenure.id,
        tenureName: TENURE_LADDER.find((t) => t.id === look.tenure!.id)?.name ?? '',
        months: look.tenure.months,
      }
    : null;
  const acc = await db.query.accounts.findFirst({ where: eq(accounts.id, accountId), columns: { playerId: true, shared: true } });
  if (!acc?.playerId || !acc.shared) return { supporter, gifted: null };
  const optedOut = await db.select({ id: users.id }).from(users).where(and(eq(users.playerId, acc.playerId), eq(users.supporterWall, false))).limit(1);
  if (optedOut.length) return { supporter, gifted: null };
  const months = await giftedMonthsInYear(acc.playerId, year);
  return { supporter, gifted: months > 0 ? { months, rank: giverRank(months).rank?.name ?? null } : null };
}

/**
 * Events this character played that started this year and have ended — only the ones a stranger
 * could see anyway (a public clan, not invite-only), since this card is public.
 */
async function yearEvents(accountId: number, year: string): Promise<YearEvent[]> {
  // clan-scope: global -- the subject is one CHARACTER across every clan it played for; filtered to public events below.
  const rows = await db
    .select({
      participantId: eventParticipants.id,
      eventId: events.id,
      name: events.name,
      visibility: events.visibility,
      endDate: events.endDate,
      forceEndedAt: events.forceEndedAt,
      clanSlug: clans.slug,
      clanKind: clans.kind,
      clanVisibility: clans.visibility,
    })
    .from(eventParticipants)
    .innerJoin(events, eq(events.id, eventParticipants.eventId))
    .innerJoin(clans, eq(clans.id, events.clanId))
    // Tile-lab boards are test runs, not events anyone played (lib/lab).
    .where(and(eq(eventParticipants.accountId, accountId), like(events.startDate, `${year}-%`), notLabClan(events.clanId)));

  const shown = rows.filter(
    (r) => r.clanVisibility === 'public' && visibilityOf(r.visibility) !== 'invited' && isEventEnded(r),
  );
  const byEvent = new Map<number, (typeof shown)[number][]>();
  for (const r of shown) byEvent.set(r.eventId, [...(byEvent.get(r.eventId) ?? []), r]);

  const out: YearEvent[] = [];
  for (const [eventId, list] of byEvent) {
    const wrapped = await getEventWrapped(eventId).catch(() => null);
    const ids = list.map((r) => r.participantId);
    const me = wrapped?.players.find((p) => p.playerIds.some((id) => ids.includes(id))) ?? null;
    out.push({
      eventId,
      name: list[0].name,
      clanSlug: list[0].clanSlug,
      clanKind: list[0].clanKind,
      cardKey: me ? Math.min(...me.playerIds) : null,
      team: me?.team && me.team.of > 1 ? { name: me.team.name, rank: me.team.rank, of: me.team.of } : null,
      placeInTeam: me?.placeInTeam ?? null,
      points: me?.points ?? 0,
      awards: me?.awards.map((a) => `${a.emoji} ${a.title}`) ?? [],
    });
  }
  return out.sort((a, b) => a.eventId - b.eventId);
}
