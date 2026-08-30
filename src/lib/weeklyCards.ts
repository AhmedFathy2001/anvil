import { db } from '@/db';
import { clanRoster, memberDailyStats, weeklyCompetitions, weeklyParticipants } from '@/db/schema';
import { and, count, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import { BOSSES, EFFICIENCY_LABELS, SKILL_LABELS } from '@/lib/constants';
import { competitionIconUrl } from '@/lib/tileIcons';
import { dayRange, metricGain, type CompetitionType } from '@/lib/competitionInsights';

/**
 * A weekly competition, reduced to what a card needs.
 *
 * The sibling of lib/eventCards, and deliberately the same shape of thing: the hub draws boards and
 * weeks with one card grammar, so the two loaders have to agree about what a card IS. What differs
 * is where the number comes from — a board sums completions, a week subtracts a baseline from a
 * current value — and that difference stays in here.
 *
 * BOUNDED, like eventCards. A clan running one weekly a week has fifty-two a year; three a week is
 * over a hundred and fifty. So: the caller says how many finished weeks it wants, the entrant
 * counts and leaders are looked up only for those, and the day-by-day shape — the one genuinely
 * expensive read — is fetched only for the ones that are running, because that is the only place
 * the hub draws it.
 */

export type WeeklyKind = 'sotw' | 'botw' | 'eff';

export interface WeeklyCard {
  id: number;
  kind: WeeklyKind;
  /** 'SOTW: Agility' — whatever the admin named it. */
  name: string;
  /** The thing being raced: 'Agility', 'Zulrah', 'EHP'. */
  metricLabel: string;
  iconUrl: string | null;
  state: 'live' | 'upcoming' | 'past';
  startDate: string;
  endDate: string;
  entrants: number;
  /** XP | KC | h — what the number on the card is measured in. */
  unit: string;
  /** Leader while it runs, winner once it's done. Null before anyone has gained anything. */
  top: { rsn: string; value: number; tied: boolean } | null;
  /** Clan-wide gain per day, for the sparkline. Empty unless the caller asked and it's drawable. */
  days: number[];
}

export interface LoadWeeklyCardsOptions {
  /** Cap on finished weeks. Live and upcoming are never capped — several can run at once. */
  pastLimit?: number;
  /** Fetch the per-day shape for the weeks that are running. Off unless a surface draws it. */
  withDailyShape?: boolean;
}

const KIND: Record<string, WeeklyKind> = { skill: 'sotw', boss: 'botw', efficiency: 'eff' };

function metricLabel(type: string, metric: string): string {
  if (type === 'skill') return SKILL_LABELS[metric] ?? metric;
  if (type === 'efficiency') return EFFICIENCY_LABELS[metric] ?? metric.toUpperCase();
  return BOSSES.find((b) => b.key === metric)?.label ?? metric;
}

const unitFor = (type: string) => (type === 'skill' ? 'XP' : type === 'boss' ? 'KC' : 'h');

export async function loadWeeklyCards(
  clanId: number,
  opts: LoadWeeklyCardsOptions = {},
  now: Date = new Date(),
): Promise<WeeklyCard[]> {
  const byStatus = (status: string, take?: number) => {
    const q = db
      .select()
      .from(weeklyCompetitions)
      .where(and(eq(weeklyCompetitions.clanId, clanId), eq(weeklyCompetitions.status, status)))
      .orderBy(desc(weeklyCompetitions.startDate));
    return take != null ? q.limit(take) : q;
  };

  const [live, upcoming, past] = await Promise.all([
    byStatus('active'),
    byStatus('upcoming'),
    byStatus('completed', opts.pastLimit),
  ]);
  const shown = [...live, ...upcoming, ...past];
  if (shown.length === 0) return [];

  const ids = shown.map((c) => c.id);

  // The leader of each competition, without reading its entrants. One window function beats N
  // queries and beats pulling every participant row into JS to sort it there.
  const gained = sql<number>`coalesce(${weeklyParticipants.currentValue}, 0) - coalesce(${weeklyParticipants.baselineValue}, 0)`;
  const ranked = db
    .select({
      competitionId: weeklyParticipants.competitionId,
      rsn: weeklyParticipants.rsn,
      gained: gained.as('gained'),
      // Ordered by name as well as by gain: on a boss week the top of the board is regularly a tie
      // (4, 4, 1, 1), and without a second key SQLite is free to hand back either one — so the card
      // would name a different "leader" between two renders of the same data.
      rn: sql<number>`row_number() over (partition by ${weeklyParticipants.competitionId} order by ${gained} desc, ${weeklyParticipants.rsn} asc)`.as('rn'),
    })
    .from(weeklyParticipants)
    .where(inArray(weeklyParticipants.competitionId, ids))
    .as('ranked');

  const [entrantRows, leaderRows] = await Promise.all([
    db
      .select({ competitionId: weeklyParticipants.competitionId, c: count() })
      .from(weeklyParticipants)
      .where(inArray(weeklyParticipants.competitionId, ids))
      .groupBy(weeklyParticipants.competitionId),
    // Top TWO, so a tie at the top can be said out loud rather than silently resolved.
    db
      .select({ competitionId: ranked.competitionId, rsn: ranked.rsn, gained: ranked.gained, rn: ranked.rn })
      .from(ranked)
      .where(lte(ranked.rn, 2)),
  ]);

  const entrants = new Map(entrantRows.map((r) => [r.competitionId, r.c]));
  const leaders = new Map<number, { rsn: string; gained: number; tied: boolean }>();
  for (const row of leaderRows.filter((r) => r.rn === 1)) {
    const runnerUp = leaderRows.find((r) => r.competitionId === row.competitionId && r.rn === 2);
    leaders.set(row.competitionId, {
      rsn: row.rsn,
      gained: row.gained,
      tied: runnerUp != null && runnerUp.gained === row.gained && row.gained > 0,
    });
  }

  // The day-by-day shape, for the running weeks only. member_daily_stats is indexed on `day`, so
  // asking for the current week's rows is a range scan rather than a table sweep — but it is still
  // the heaviest read here, which is why it is opt-in and never runs for the archive.
  const shapeFor = new Map<number, number[]>();
  if (opts.withDailyShape && live.length > 0) {
    const earliest = live.map((c) => c.startDate.slice(0, 10)).sort()[0];
    // Resolve each participant to their ACCOUNT first (weekly_participants.clan_member_id is a SEAT;
    // member_daily_stats is account-keyed), then read the daily rows for exactly those accounts. The
    // old code matched a set of SEAT ids against an account key — never equal, so every card's shape
    // came back flat — and fetched the daily table with no account filter at all.
    // clan-scope: global -- joined onto a driving query that is already scoped; this clause adds columns, not rows.
    const memberRows = await db
      .select({
        competitionId: weeklyParticipants.competitionId,
        accountId: clanRoster.accountId,
      })
      .from(weeklyParticipants)
      .leftJoin(clanRoster, eq(weeklyParticipants.clanMemberId, clanRoster.id))
      .where(inArray(weeklyParticipants.competitionId, live.map((c) => c.id)));
    const shapeAccountIds = [...new Set(memberRows.map((m) => m.accountId).filter((id): id is number => id != null))];
    const dailyRows = shapeAccountIds.length
      ? await db
          .select({
            accountId: memberDailyStats.accountId,
            day: memberDailyStats.day,
            xpGained: memberDailyStats.xpGained,
            ehpMilliGained: memberDailyStats.ehpMilliGained,
            ehbMilliGained: memberDailyStats.ehbMilliGained,
            deltas: memberDailyStats.deltas,
          })
          .from(memberDailyStats)
          .where(and(gte(memberDailyStats.day, earliest), inArray(memberDailyStats.accountId, shapeAccountIds)))
      : [];

    const parsed = dailyRows.map((r) => ({ ...r, parsed: safeParse(r.deltas) }));
    for (const comp of live) {
      const members = new Set(
        memberRows
          .filter((m) => m.competitionId === comp.id && m.accountId != null)
          .map((m) => m.accountId as number),
      );
      const range = dayRange(comp.startDate, comp.endDate);
      const byDay = new Map(range.map((d) => [d, 0]));
      const type = (['skill', 'boss', 'efficiency'].includes(comp.type) ? comp.type : 'skill') as CompetitionType;
      for (const row of parsed) {
        if (!members.has(row.accountId) || !byDay.has(row.day)) continue;
        byDay.set(
          row.day,
          (byDay.get(row.day) ?? 0) +
            metricGain(
              {
                rsn: '',
                day: row.day,
                xpGained: row.xpGained,
                ehpMilliGained: row.ehpMilliGained,
                ehbMilliGained: row.ehbMilliGained,
                deltas: row.parsed,
              },
              type,
              comp.metric,
            ),
        );
      }
      const today = now.toISOString().slice(0, 10);
      shapeFor.set(comp.id, range.filter((d) => d <= today).map((d) => byDay.get(d) ?? 0));
    }
  }

  return shown.map((c) => {
    const state: WeeklyCard['state'] =
      c.status === 'active' ? 'live' : c.status === 'upcoming' ? 'upcoming' : 'past';
    const leader = leaders.get(c.id);
    return {
      id: c.id,
      kind: KIND[c.type] ?? 'sotw',
      name: c.title,
      metricLabel: metricLabel(c.type, c.metric),
      iconUrl: competitionIconUrl(c.type, c.metric),
      state,
      startDate: c.startDate,
      endDate: c.endDate,
      entrants: entrants.get(c.id) ?? 0,
      unit: unitFor(c.type),
      top: leader && leader.gained > 0 ? { rsn: leader.rsn, value: leader.gained, tied: leader.tied } : null,
      days: shapeFor.get(c.id) ?? [],
    };
  });
}

function safeParse(json: string | null): Record<string, Record<string, number>> | null {
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}
