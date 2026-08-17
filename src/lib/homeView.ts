import { db } from '@/db';
import {
  clanMembers,
  completions,
  events,
  memberDailyStats,
  memberMilestones,
  settings,
  teams,
  tiles,
  weeklyCompetitions,
  weeklyParticipants,
} from '@/db/schema';
import { and, count, desc, eq, gte, inArray, isNotNull, isNull, lte, or } from 'drizzle-orm';
import { BOSSES, EFFICIENCY_LABELS, SKILL_LABELS } from '@/lib/constants';
import { getClanDisplayName } from '@/lib/pluginConfig';
import { competitionIconUrl } from '@/lib/tileIcons';
import { parseEventRules } from '@/lib/eventRules';
import { eventAxes } from '@/lib/eventAxes';
import { dailyTrust, dayRange, metricGain, type CompetitionType } from '@/lib/competitionInsights';
import { loadEventCards, type EventCard } from '@/lib/eventCards';
import { computeIndividualStandings } from '@/lib/memberBreakdown';
import { parseContributionSnapshot } from '@/lib/statTracking';
import { loadPlayerOwners } from '@/lib/draftProfiles';
import { ladderLifecycle } from '@/lib/ladderView';
import { monthWindow } from '@/lib/ladderInsights';
import { players as playersTable, submissions as submissionsTable } from '@/db/schema';

/**
 * Everything the home page shows, assembled once.
 *
 * The old page led with a name and four counters and then listed what was live. It never showed the
 * clan itself: how much anyone had actually done this week, who won anything, or that there were
 * thirty competitions before this one. All of that already exists in the database — the weekly rows,
 * the completions, and the daily stats the sweep writes — so this is one assembly pass, not new
 * tracking.
 */

/** How many weeklies the rail carries. A year is fifty-two; the rail is a highlight, not an archive. */
const RAIL_LIMIT = 8;
/** Only recent weeks get their day-by-day shape — older ones keep the result and skip the query. */
const SHAPE_WINDOW_DAYS = 60;

export interface HomeWeekly {
  id: number;
  title: string;
  kind: 'SOTW' | 'BOTW' | 'EOTW';
  type: CompetitionType;
  metricLabel: string;
  iconUrl: string | null;
  status: 'active' | 'upcoming' | 'completed';
  startDate: string;
  endDate: string;
  entrants: number;
  /** Winner (completed) or current leader (active), with their gain. Null before anyone scores. */
  top: { rsn: string; value: number } | null;
  /** Clan-wide gain per day across the competition, for the card's shape. Empty when out of window. */
  days: number[];
}

/** The home page draws the same card as the events index (lib/eventCards). */
export type HomeEvent = EventCard;

export interface HomeYou {
  rsn: string;
  /** Rank in the live competition, when there is one and they're on it. */
  weekly: { rank: number; total: number; label: string; iconUrl: string | null } | null;
  /** Rank on a live ladder, when one is running. */
  ladder: { rank: number; total: number; eventName: string } | null;
  xpThisWeek: number;
  milestones: number;
  activeDays: number;
  daysElapsed: number;
}

export interface HomeView {
  clanName: string;
  discordInvite: string | null;
  memberCount: number;
  liveEventCount: number;
  competitionsRun: number;
  /** Clan-wide XP per day for the current week, and how that compares with the week before. */
  clanWeek: { days: { day: string; xp: number }[]; total: number; deltaPct: number | null };
  milestones: { rsn: string; text: string; iconUrl: string | null; day: string }[];
  weeklies: HomeWeekly[];
  events: HomeEvent[];
  /** The two cards at the top: what's live, or (when nothing is) what's next and what just ended. */
  live: { weekly: HomeWeekly | null; event: HomeEvent | null; next: HomeWeekly | null; justFinished: HomeWeekly | null };
  you: HomeYou | null;
}

const KIND: Record<string, HomeWeekly['kind']> = { skill: 'SOTW', boss: 'BOTW', efficiency: 'EOTW' };

function metricLabel(type: string, metric: string): string {
  if (type === 'skill') return SKILL_LABELS[metric] ?? metric;
  if (type === 'efficiency') return EFFICIENCY_LABELS[metric] ?? metric.toUpperCase();
  return BOSSES.find((b) => b.key === metric)?.label ?? metric;
}

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

export async function buildHomeView(viewerMemberIds: number[] = [], now: Date = new Date()): Promise<HomeView> {
  const nowIso = now.toISOString();
  const clanName = await getClanDisplayName();
  const inviteRow = await db.query.settings.findFirst({ where: eq(settings.key, 'discord_invite_url') });
  const discordInvite = inviteRow?.value?.trim() || process.env.DISCORD_INVITE_URL?.trim() || null;

  const memberCount = await db
    .select({ c: count() })
    .from(clanMembers)
    .where(and(isNull(clanMembers.leftAt), eq(clanMembers.isGuest, 0)))
    .then((r) => r[0]?.c ?? 0);

  // ---- Weeklies: the rail, and a count for the rest ----------------------------------------------
  // Live and next always make the rail; the rest of the slots go to the most recent finished ones.
  // Fetched as three bounded queries rather than one unbounded one: a clan running three weeklies a
  // week has a hundred and fifty a year, and the home page needs eight of them and a number.
  const [live, upcoming, finished, competitionsRun] = await Promise.all([
    db
      .select()
      .from(weeklyCompetitions)
      .where(eq(weeklyCompetitions.status, 'active'))
      .orderBy(desc(weeklyCompetitions.startDate)),
    db
      .select()
      .from(weeklyCompetitions)
      .where(eq(weeklyCompetitions.status, 'upcoming'))
      .orderBy(desc(weeklyCompetitions.startDate))
      .limit(2),
    db
      .select()
      .from(weeklyCompetitions)
      .where(eq(weeklyCompetitions.status, 'completed'))
      .orderBy(desc(weeklyCompetitions.startDate))
      .limit(RAIL_LIMIT),
    db
      .select({ c: count() })
      .from(weeklyCompetitions)
      .where(eq(weeklyCompetitions.status, 'completed'))
      .then((r) => r[0]?.c ?? 0),
  ]);
  const railComps = [...live, ...upcoming, ...finished].slice(0, RAIL_LIMIT);

  const railIds = railComps.map((c) => c.id);
  const partRows = railIds.length
    ? await db
        .select({
          competitionId: weeklyParticipants.competitionId,
          clanMemberId: weeklyParticipants.clanMemberId,
          rsn: weeklyParticipants.rsn,
          baselineValue: weeklyParticipants.baselineValue,
          currentValue: weeklyParticipants.currentValue,
        })
        .from(weeklyParticipants)
        .where(inArray(weeklyParticipants.competitionId, railIds))
    : [];

  // One daily-stats read covers every recent competition on the rail: bounded by the earliest day
  // any of them still needs, so an old archive week costs nothing.
  const shapeCutoff = dayKey(new Date(now.getTime() - SHAPE_WINDOW_DAYS * 86_400_000));
  const shapeComps = railComps.filter((c) => c.endDate.slice(0, 10) >= shapeCutoff);
  const earliestDay = shapeComps.length
    ? shapeComps.map((c) => c.startDate.slice(0, 10)).sort()[0]
    : null;
  const dailyRows = earliestDay
    ? await db
        .select({
          clanMemberId: memberDailyStats.clanMemberId,
          day: memberDailyStats.day,
          xpGained: memberDailyStats.xpGained,
          ehpMilliGained: memberDailyStats.ehpMilliGained,
          ehbMilliGained: memberDailyStats.ehbMilliGained,
          deltas: memberDailyStats.deltas,
        })
        .from(memberDailyStats)
        .where(gte(memberDailyStats.day, earliestDay))
    : [];
  const parsedDaily = dailyRows.map((r) => ({
    ...r,
    rsn: '',
    parsed: safeParse(r.deltas),
  }));

  const weeklies: HomeWeekly[] = railComps.map((c) => {
    const type = (['skill', 'boss', 'efficiency'].includes(c.type) ? c.type : 'skill') as CompetitionType;
    const parts = partRows.filter((p) => p.competitionId === c.id);
    const ranked = parts
      .map((p) => ({
        rsn: p.rsn,
        value: (p.currentValue ?? 0) - (p.baselineValue ?? 0),
        trackable: p.clanMemberId != null,
      }))
      .filter((p) => p.value > 0)
      .sort((a, b) => b.value - a.value);

    let days: number[] = [];
    if (shapeComps.some((s) => s.id === c.id)) {
      const range = dayRange(c.startDate, c.endDate);
      const memberIds = new Set(parts.map((p) => p.clanMemberId).filter((id): id is number => id != null));
      const byDay = new Map(range.map((d) => [d, 0]));
      for (const row of parsedDaily) {
        if (!memberIds.has(row.clanMemberId) || !byDay.has(row.day)) continue;
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
              c.metric,
            ),
        );
      }
      const today = dayKey(now);
      days = range.filter((d) => d <= today).map((d) => byDay.get(d) ?? 0);
      // Same judgement the competition page makes: a shape assembled from a fraction of the week
      // isn't a rough version of it, it's a biased one. A card too small to caption is the worst
      // place to show a chart that needs an asterisk, so it just doesn't get one.
      const tracked = days.reduce((a, b) => a + b, 0);
      // Guests can never appear in the day-by-day, so they don't count against it (competitionView
      // scores the same way — the two surfaces must agree about whether a week is drawable).
      const trackable = ranked.reduce((a, b) => a + (b.trackable ? b.value : 0), 0);
      if (dailyTrust(tracked, trackable, days.some((d) => d > 0)) !== 'ok') days = [];
    }

    return {
      id: c.id,
      title: c.title,
      kind: KIND[c.type] ?? 'SOTW',
      type,
      metricLabel: metricLabel(c.type, c.metric),
      iconUrl: competitionIconUrl(c.type, c.metric),
      status: (c.status as HomeWeekly['status']) ?? 'completed',
      startDate: c.startDate,
      endDate: c.endDate,
      entrants: parts.length,
      top: ranked[0] ?? null,
      days,
    };
  });

  // ---- Events: what's live and what it came to --------------------------------------------------
  // Shared with the events index so the two pages can never disagree about who is leading.
  const homeEvents = await loadEventCards({ pastLimit: 6 }, now);
  // The same predicate the events index uses for "live", asked of the database instead of read out of
  // every event the clan has ever run: started, not force-ended, and not past its end date.
  // Several boards can be live at once, so this is a list, not a lookup.
  const liveEvents = await db
    .select()
    .from(events)
    .where(
      and(
        isNull(events.forceEndedAt),
        isNotNull(events.startDate),
        lte(events.startDate, nowIso),
        or(isNull(events.endDate), gte(events.endDate, nowIso)),
      ),
    )
    .orderBy(desc(events.createdAt));

  // ---- The clan's own week ----------------------------------------------------------------------
  const weekStart = dayKey(new Date(now.getTime() - 6 * 86_400_000));
  const prevStart = dayKey(new Date(now.getTime() - 13 * 86_400_000));
  const clanRows = await db
    .select({ day: memberDailyStats.day, xpGained: memberDailyStats.xpGained })
    .from(memberDailyStats)
    .where(gte(memberDailyStats.day, prevStart));
  const byDay = new Map<string, number>();
  for (const r of clanRows) byDay.set(r.day, (byDay.get(r.day) ?? 0) + r.xpGained);
  const weekDays = Array.from({ length: 7 }, (_, i) => dayKey(new Date(now.getTime() - (6 - i) * 86_400_000)));
  const days = weekDays.map((day) => ({ day, xp: byDay.get(day) ?? 0 }));
  const total = days.reduce((s, d) => s + d.xp, 0);
  const prevTotal = Array.from({ length: 7 }, (_, i) => dayKey(new Date(now.getTime() - (13 - i) * 86_400_000)))
    .reduce((s, day) => s + (byDay.get(day) ?? 0), 0);
  const deltaPct = prevTotal > 0 ? Math.round(((total - prevTotal) / prevTotal) * 100) : null;

  // ---- Milestones ------------------------------------------------------------------------------
  const milestoneRows = await db
    .select({
      clanMemberId: memberMilestones.clanMemberId,
      kind: memberMilestones.kind,
      metric: memberMilestones.metric,
      threshold: memberMilestones.threshold,
      noticedAt: memberMilestones.noticedAt,
    })
    .from(memberMilestones)
    .where(and(gte(memberMilestones.noticedAt, `${weekStart}T00:00:00.000Z`), lte(memberMilestones.noticedAt, nowIso)))
    .orderBy(desc(memberMilestones.noticedAt))
    .limit(6);
  const milestoneMemberIds = [...new Set(milestoneRows.map((m) => m.clanMemberId))];
  const memberNames = milestoneMemberIds.length
    ? await db
        .select({ id: clanMembers.id, rsn: clanMembers.rsn })
        .from(clanMembers)
        .where(inArray(clanMembers.id, milestoneMemberIds))
    : [];
  const nameById = new Map(memberNames.map((m) => [m.id, m.rsn]));
  const milestones = milestoneRows.map((m) => ({
    rsn: nameById.get(m.clanMemberId) ?? 'Someone',
    text: milestoneSentence(m.kind, m.metric, m.threshold),
    iconUrl: m.metric ? competitionIconUrl(m.kind === 'kc' ? 'boss' : 'skill', m.metric) : null,
    day: m.noticedAt.slice(0, 10),
  }));

  // ---- You -------------------------------------------------------------------------------------
  let you: HomeYou | null = null;
  if (viewerMemberIds.length > 0) {
    const mine = await db
      .select({ id: clanMembers.id, rsn: clanMembers.rsn })
      .from(clanMembers)
      .where(inArray(clanMembers.id, viewerMemberIds));
    if (mine.length > 0) {
      const myIds = new Set(mine.map((m) => m.id));
      const myDaily = clanRows.length
        ? await db
            .select({ day: memberDailyStats.day, xpGained: memberDailyStats.xpGained })
            .from(memberDailyStats)
            .where(and(inArray(memberDailyStats.clanMemberId, [...myIds]), gte(memberDailyStats.day, weekStart)))
        : [];
      const liveComp = weeklies.find((w) => w.status === 'active');
      let weekly: HomeYou['weekly'] = null;
      if (liveComp) {
        const ranked = partRows
          .filter((p) => p.competitionId === liveComp.id)
          .map((p) => ({ ...p, gained: (p.currentValue ?? 0) - (p.baselineValue ?? 0) }))
          .sort((a, b) => b.gained - a.gained);
        const idx = ranked.findIndex((p) => p.clanMemberId != null && myIds.has(p.clanMemberId));
        if (idx >= 0) {
          weekly = {
            rank: idx + 1,
            total: ranked.length,
            label: liveComp.metricLabel,
            iconUrl: liveComp.iconUrl,
          };
        }
      }
      // A live ladder ranks people, so the viewer has a place on it — worth a pill, and cheap
      // because it only runs when a ladder is actually running (usually one, often none).
      let ladder: HomeYou['ladder'] = null;
      const ladderEvent = liveEvents.find((e) => eventAxes({ ...e, rules: parseEventRules(e.rules) }).competitors === 'individuals');
      if (ladderEvent) {
        const ladderPlayers = await db.select().from(playersTable).where(eq(playersTable.eventId, ladderEvent.id));
        const myPlayerIds = new Set(
          ladderPlayers.filter((p) => p.clanMemberId != null && myIds.has(p.clanMemberId)).map((p) => p.id),
        );
        if (myPlayerIds.size > 0) {
          // Loaded here rather than shared: this only runs when a ladder is live AND the viewer is
          // on it, so it costs nothing on an ordinary page load.
          const ladderTiles = await db.select().from(tiles).where(eq(tiles.eventId, ladderEvent.id));
          const ladderTeams = await db.select().from(teams).where(eq(teams.eventId, ladderEvent.id));
          const ladderTileIds = ladderTiles.map((t) => t.id);
          const ladderCompletions = ladderTileIds.length
            ? await db.select().from(completions).where(inArray(completions.tileId, ladderTileIds))
            : [];
          const ladderSubs = ladderTileIds.length
            ? await db
                .select({
                  tileId: submissionsTable.tileId,
                  teamId: submissionsTable.teamId,
                  creditPlayerId: submissionsTable.creditPlayerId,
                  amount: submissionsTable.amount,
                })
                .from(submissionsTable)
                .where(inArray(submissionsTable.tileId, ladderTileIds))
            : [];
          // Rank them on the board they'll actually land on: a rolling ladder opens on the current
          // season, so an all-time rank here would say "#1" and the page would then say "#4".
          const lifecycle = ladderLifecycle({ endDate: ladderEvent.endDate, rules: ladderEvent.rules });
          const seasonWindow = lifecycle === 'bounded' ? null : monthWindow(now);
          const standings = computeIndividualStandings({
            scoringMode: ladderEvent.scoringMode,
            teams: ladderTeams,
            players: ladderPlayers,
            tiles: ladderTiles,
            // The frozen KC/XP split is stored as JSON text; the breakdown wants it parsed, or a
            // completed stat tile would score for nobody.
            completions: ladderCompletions
              .filter((c) => !seasonWindow || (c.completedAt >= seasonWindow.start && c.completedAt < seasonWindow.end))
              .map((c) => ({ ...c, statContributions: parseContributionSnapshot(c.statContributions) })),
            submissions: ladderSubs,
            ownerByPlayerId: await loadPlayerOwners(ladderPlayers),
            accountSlotMode: ladderEvent.accountSlotMode,
          });
          const idx = standings.findIndex((r) => myPlayerIds.has(r.playerId));
          if (idx >= 0) ladder = { rank: idx + 1, total: standings.length, eventName: ladderEvent.name };
        }
      }

      you = {
        rsn: mine[0].rsn,
        weekly,
        ladder,
        xpThisWeek: myDaily.reduce((s, r) => s + r.xpGained, 0),
        milestones: milestoneRows.filter((m) => myIds.has(m.clanMemberId)).length,
        activeDays: new Set(myDaily.filter((r) => r.xpGained > 0).map((r) => r.day)).size,
        daysElapsed: 7,
      };
    }
  }

  const activeWeekly = weeklies.find((w) => w.status === 'active') ?? null;
  const liveEvent = homeEvents.find((e) => e.status === 'live') ?? null;

  return {
    clanName,
    discordInvite,
    memberCount,
    liveEventCount: liveEvents.length,
    competitionsRun,
    clanWeek: { days, total, deltaPct },
    milestones,
    weeklies,
    events: homeEvents,
    live: {
      weekly: activeWeekly,
      event: liveEvent,
      next: weeklies.find((w) => w.status === 'upcoming') ?? null,
      justFinished: weeklies.find((w) => w.status === 'completed') ?? null,
    },
    you,
  };
}

function safeParse(raw: string | null): { skills?: Record<string, number>; bosses?: Record<string, number> } | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw);
    return p && typeof p === 'object' ? p : null;
  } catch {
    return null;
  }
}

/** "hit 99 Agility" / "passed 1,000 Zulrah KC" — the readable half of a milestone row. */
function milestoneSentence(kind: string, metric: string | null, threshold: number): string {
  const label = metric ? metricLabel(kind === 'kc' ? 'boss' : 'skill', metric) : null;
  switch (kind) {
    case 'level':
      return `hit ${threshold} ${label ?? ''}`.trim();
    case 'xp':
      return `passed ${(threshold / 1_000_000).toLocaleString()}M ${label ?? 'total'} XP`;
    case 'kc':
      return `passed ${threshold.toLocaleString()} ${label ?? ''} KC`.replace(/\s+/g, ' ');
    case 'total':
      return `reached ${threshold.toLocaleString()} total level`;
    case 'ehp':
      return `passed ${threshold.toLocaleString()} EHP`;
    case 'ehb':
      return `passed ${threshold.toLocaleString()} EHB`;
    default:
      return `crossed ${threshold.toLocaleString()}`;
  }
}
