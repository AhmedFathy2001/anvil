import { db } from '@/db';
import { memberDailyStats, memberMilestones, weeklyCompetitions, clanMembers } from '@/db/schema';
import { and, eq, gte, inArray, lte, ne, lt, desc } from 'drizzle-orm';
import { computeLeaderboard, getEffectiveParticipants } from '@/lib/weekly';
import { BOSSES, SKILL_LABELS, EFFICIENCY_LABELS, EFFICIENCY_SCALE } from '@/lib/constants';
import {
  activeStreak,
  dailyCoverage,
  dailyTrust,
  type DailyTrust,
  buildSeries,
  dailyLeaders,
  dailyTotals,
  dayRange,
  daysElapsed,
  mostConsistent,
  projectTotal,
  type CompetitionType,
  type DailyRow,
  type DaySeries,
} from '@/lib/competitionInsights';

/**
 * Everything the competition page renders, assembled once on the server.
 *
 * The board itself has always been two numbers per person. The week around it — who moved on which
 * day, who is on a streak, whether this week beats the last one — comes from `member_daily_stats`,
 * which the 15-minute sweep already writes, so the whole page is reads over existing rows.
 */

export interface CompetitionEntry {
  rsn: string;
  /** The competition's own number: currentValue − baselineValue. Authoritative. */
  gained: number;
  /**
   * How much of that the daily history actually accounts for. Lower than `gained` when the sweep
   * started watching this member after the competition's baseline was taken (a gain only lands on a
   * day once there is an earlier snapshot to diff against), and — for every week recorded before the
   * fix in lib/statHistory — because each day's per-metric detail was overwritten by its last tick
   * rather than accumulated. Those weeks can't be repaired, so the page gates on it instead.
   */
  trackedGain: number;
  /** Gain per day, index-aligned with {@link CompetitionView.days}. */
  days: number[];
  /** Today's gain (the last elapsed day). */
  today: number;
  streak: number;
  /** Baseline looks stale (weekly_participants.flagged) — say so rather than rank a bad number. */
  flagged: boolean;
  flagReason: string | null;
  isMe: boolean;
}

export interface CompetitionMilestone {
  emoji: string;
  /** Who crossed it. */
  rsn: string;
  /** What they did — "hit", "passed", "reached". */
  action: string;
  /** The thing itself — "99 Agility", "1,000 Zulrah KC". */
  highlight: string;
  day: string;
}

export interface CompetitionRecord {
  emoji: string;
  label: string;
  who: string;
  value: string;
}

export interface CompetitionView {
  type: CompetitionType;
  metric: string;
  metricLabel: string;
  /** 'XP' | 'KC' | 'hours' — the unit every number on the page is in. */
  unit: string;
  /** What members did to earn it, for the heat grid's title: "trained" / "killed" / "played". */
  verb: string;
  /** Every UTC day of the competition, and how many have happened. */
  days: string[];
  elapsed: number;
  entries: CompetitionEntry[];
  /** Clan-wide gain per day, and who led each. */
  dailyTotals: number[];
  dailyLeaders: (string | null)[];
  clanTotal: number;
  /** Clan total the day-by-day can explain. Below clanTotal = the shape is a partial account. */
  trackedTotal: number;
  todayTotal: number;
  scoring: number;
  /** Where the clan lands at this pace, and how that compares to the last competition on this metric. */
  projected: number | null;
  previous: { title: string; total: number; deltaPct: number } | null;
  /** The viewer's own row, if they're in it. */
  me: { rank: number; entry: CompetitionEntry; behind: { rsn: string; amount: number } | null } | null;
  milestones: CompetitionMilestone[];
  records: CompetitionRecord[];
  /**
   * Whether the week's shape is worth drawing: 'none' (guest-only board or pre-history competition),
   * 'thin' (rows exist but explain too little of the standings to be honest about), or 'ok'.
   */
  trust: DailyTrust;
  /** Fraction of clanTotal the daily rows account for, for the copy that explains a thin week. */
  coverage: number;
}

function metricLabel(type: CompetitionType, metric: string): string {
  if (type === 'skill') return SKILL_LABELS[metric] || metric;
  if (type === 'efficiency') return EFFICIENCY_LABELS[metric] || metric.toUpperCase();
  return BOSSES.find((b) => b.key === metric)?.label || metric;
}

const UNIT: Record<CompetitionType, string> = { skill: 'XP', boss: 'KC', efficiency: 'hours' };
const VERB: Record<CompetitionType, string> = { skill: 'trained', boss: 'killed', efficiency: 'played' };

/** Milestone rows are generic; this turns one into the sentence a member reads. */
function milestoneText(
  kind: string,
  metric: string | null,
  threshold: number,
): { emoji: string; action: string; highlight: string } {
  const label = metric ? metricLabel(kind === 'kc' ? 'boss' : 'skill', metric) : null;
  switch (kind) {
    case 'level':
      return { emoji: '🏅', action: 'hit', highlight: `${threshold} ${label ?? 'a skill'}` };
    case 'xp':
      return {
        emoji: '📈',
        action: 'passed',
        highlight: `${(threshold / 1_000_000).toLocaleString()}M ${label ?? 'total'} XP`,
      };
    case 'kc':
      return { emoji: '💀', action: 'passed', highlight: `${threshold.toLocaleString()} ${label ?? ''} KC`.replace(/\s+/g, ' ') };
    case 'total':
      return { emoji: '🎯', action: 'reached', highlight: `${threshold.toLocaleString()} total level` };
    case 'ehp':
      return { emoji: '⏱️', action: 'passed', highlight: `${threshold.toLocaleString()} EHP` };
    case 'ehb':
      return { emoji: '⚔️', action: 'passed', highlight: `${threshold.toLocaleString()} EHB` };
    default:
      return { emoji: '⭐', action: 'crossed', highlight: threshold.toLocaleString() };
  }
}

export async function buildCompetitionView(
  competition: {
    id: number;
    type: string;
    metric: string;
    title: string;
    startDate: string;
    endDate: string;
    status: string;
  },
  viewerMemberIds: number[] = [],
  now: Date = new Date(),
): Promise<CompetitionView> {
  const type = (['skill', 'boss', 'efficiency'].includes(competition.type)
    ? competition.type
    : 'skill') as CompetitionType;
  const metric = competition.metric;

  const participants = await getEffectiveParticipants(competition.id);
  const board = computeLeaderboard(participants);
  const days = dayRange(competition.startDate, competition.endDate);
  const elapsed = daysElapsed(days, now);

  // Daily rows for exactly these members, over exactly these days. Guests (no clanMemberId) have no
  // daily history — they still rank, they just have no shape to draw.
  const memberIdByRsn = new Map<string, number>();
  for (const p of participants) if (p.clanMemberId != null) memberIdByRsn.set(p.rsn, p.clanMemberId);
  const memberIds = [...new Set(memberIdByRsn.values())];

  let dailyRows: DailyRow[] = [];
  if (memberIds.length > 0 && days.length > 0) {
    const rsnByMemberId = new Map<number, string>();
    for (const [rsn, id] of memberIdByRsn) rsnByMemberId.set(id, rsn);
    const rows = await db
      .select({
        clanMemberId: memberDailyStats.clanMemberId,
        day: memberDailyStats.day,
        xpGained: memberDailyStats.xpGained,
        ehpMilliGained: memberDailyStats.ehpMilliGained,
        ehbMilliGained: memberDailyStats.ehbMilliGained,
        deltas: memberDailyStats.deltas,
      })
      .from(memberDailyStats)
      .where(
        and(
          inArray(memberDailyStats.clanMemberId, memberIds),
          gte(memberDailyStats.day, days[0]),
          lte(memberDailyStats.day, days[days.length - 1]),
        ),
      );
    dailyRows = rows.map((r) => ({
      rsn: rsnByMemberId.get(r.clanMemberId) ?? '',
      day: r.day,
      xpGained: r.xpGained,
      ehpMilliGained: r.ehpMilliGained,
      ehbMilliGained: r.ehbMilliGained,
      deltas: parseDeltas(r.deltas),
    }));
  }

  const series = buildSeries(board.map((b) => b.rsn), dailyRows, days, type, metric);
  const seriesByRsn = new Map(series.map((s) => [s.rsn, s]));
  const flagByRsn = new Map(participants.map((p) => [p.rsn, { flagged: !!p.flagged, reason: p.flagReason ?? null }]));
  const myRsns = new Set(
    participants.filter((p) => p.clanMemberId != null && viewerMemberIds.includes(p.clanMemberId)).map((p) => p.rsn),
  );

  const entries: CompetitionEntry[] = board.map((b) => {
    const s = seriesByRsn.get(b.rsn) ?? { rsn: b.rsn, days: days.map(() => 0) };
    const flag = flagByRsn.get(b.rsn);
    return {
      rsn: b.rsn,
      gained: b.gained,
      trackedGain: s.days.slice(0, elapsed).reduce((sum, d) => sum + d, 0),
      days: s.days,
      today: s.days[elapsed - 1] ?? 0,
      streak: activeStreak(s.days, elapsed),
      flagged: flag?.flagged ?? false,
      flagReason: flag?.reason ?? null,
      isMe: myRsns.has(b.rsn),
    };
  });

  const totals = dailyTotals(series, days.length);
  const leaders = dailyLeaders(series, days.length);
  const clanTotal = entries.reduce((s, e) => s + Math.max(0, e.gained), 0);
  const trackedTotal = entries.reduce((s, e) => s + Math.max(0, e.trackedGain), 0);
  const todayTotal = totals[elapsed - 1] ?? 0;
  const scoring = entries.filter((e) => e.gained > 0).length;

  // Daily history only started when the sweep did, so an older competition can legitimately have a
  // board and no shape — and a competition whose rows explain only a sliver of the standings has a
  // shape that is worse than none, because the sliver is biased toward whoever the sweep caught.
  // Say which of the two it is rather than drawing either one.
  const hasRows = dailyRows.length > 0 && !totals.slice(0, elapsed).every((t) => t === 0);
  const trust = dailyTrust(trackedTotal, clanTotal, hasRows);
  const coverage = dailyCoverage(trackedTotal, clanTotal);

  const projected = projectTotal(clanTotal, elapsed, days.length);
  const previous = await loadPrevious(competition, projected ?? clanTotal);

  // The viewer's own row, and the exact distance to the person above them.
  const myIndex = entries.findIndex((e) => e.isMe);
  const me =
    myIndex >= 0
      ? {
          rank: myIndex + 1,
          entry: entries[myIndex],
          behind:
            myIndex > 0
              ? { rsn: entries[myIndex - 1].rsn, amount: entries[myIndex - 1].gained - entries[myIndex].gained }
              : null,
        }
      : null;

  const milestones = await loadMilestones(memberIds, memberIdByRsn, competition, days, type, metric);

  return {
    type,
    metric,
    metricLabel: metricLabel(type, metric),
    unit: UNIT[type],
    verb: VERB[type],
    days,
    elapsed,
    entries,
    dailyTotals: totals,
    dailyLeaders: leaders,
    clanTotal,
    trackedTotal,
    todayTotal,
    scoring,
    projected,
    previous,
    me,
    milestones,
    records: buildRecords(entries, series, elapsed, type),
    trust,
    coverage,
  };
}

function parseDeltas(raw: string | null): DailyRow['deltas'] {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * The last finished competition on the SAME metric, for the "is this a big week" comparison.
 * Comparing an Agility week to a Zulrah week would be meaningless, so the metric has to match.
 */
async function loadPrevious(
  competition: { id: number; type: string; metric: string; startDate: string },
  pace: number,
): Promise<CompetitionView['previous']> {
  const [prev] = await db
    .select({ id: weeklyCompetitions.id, title: weeklyCompetitions.title })
    .from(weeklyCompetitions)
    .where(
      and(
        eq(weeklyCompetitions.type, competition.type),
        eq(weeklyCompetitions.metric, competition.metric),
        ne(weeklyCompetitions.id, competition.id),
        lt(weeklyCompetitions.startDate, competition.startDate),
      ),
    )
    .orderBy(desc(weeklyCompetitions.startDate))
    .limit(1);
  if (!prev) return null;

  const rows = await getEffectiveParticipants(prev.id);
  const total = computeLeaderboard(rows).reduce((s, r) => s + Math.max(0, r.gained), 0);
  if (total <= 0) return null;
  return { title: prev.title, total, deltaPct: Math.round(((pace - total) / total) * 100) };
}

/**
 * Milestones crossed IN THIS COMPETITION'S METRIC while it ran, newest first.
 *
 * Every milestone the clan crossed this week already has a home on the home page. Repeating that
 * list here made the page longer without making it say anything — but "Minjoll hit 99 Agility"
 * during an Agility SOTW is not a coincidence, it is the story of the week. So this keeps the ones
 * that belong to the competition and drops the rest; when none match, the panel doesn't render.
 */
async function loadMilestones(
  memberIds: number[],
  memberIdByRsn: Map<string, number>,
  competition: { startDate: string; endDate: string },
  days: string[],
  type: CompetitionType,
  metric: string,
): Promise<CompetitionMilestone[]> {
  if (memberIds.length === 0 || days.length === 0) return [];
  const rsnByMemberId = new Map<number, string>();
  for (const [rsn, id] of memberIdByRsn) rsnByMemberId.set(id, rsn);

  const rows = await db
    .select({
      clanMemberId: memberMilestones.clanMemberId,
      kind: memberMilestones.kind,
      metric: memberMilestones.metric,
      threshold: memberMilestones.threshold,
      noticedAt: memberMilestones.noticedAt,
    })
    .from(memberMilestones)
    .where(
      and(
        inArray(memberMilestones.clanMemberId, memberIds),
        gte(memberMilestones.noticedAt, competition.startDate),
        lte(memberMilestones.noticedAt, competition.endDate),
      ),
    )
    .orderBy(desc(memberMilestones.noticedAt))
    .limit(40);

  // An efficiency week is account-wide, so its own EHP/EHB marks are the relevant ones.
  const relevant = rows.filter((r) =>
    type === 'efficiency' ? r.kind === metric : r.metric === metric,
  );

  return relevant.slice(0, 6).map((r) => ({
    ...milestoneText(r.kind, r.metric, r.threshold),
    rsn: rsnByMemberId.get(r.clanMemberId) ?? 'Someone',
    day: r.noticedAt.slice(0, 10),
  }));
}

function fmtUnit(value: number, type: CompetitionType): string {
  if (type === 'efficiency') return `${(value / EFFICIENCY_SCALE).toFixed(2)}h`;
  if (type === 'boss') return value.toLocaleString();
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

/** The week's superlatives — the things a flat table can never tell you. */
function buildRecords(
  entries: CompetitionEntry[],
  series: DaySeries[],
  elapsed: number,
  type: CompetitionType,
): CompetitionRecord[] {
  const out: CompetitionRecord[] = [];
  const scoring = entries.filter((e) => e.gained > 0);
  if (scoring.length === 0) return out;

  const streaker = [...scoring].sort((a, b) => b.streak - a.streak)[0];
  if (streaker.streak > 1) {
    out.push({ emoji: '🔥', label: 'Longest active streak', who: streaker.rsn, value: `${streaker.streak}d` });
  }

  let bigDay: { rsn: string; value: number } | null = null;
  for (const e of scoring) {
    const best = Math.max(...e.days.slice(0, elapsed), 0);
    if (!bigDay || best > bigDay.value) bigDay = { rsn: e.rsn, value: best };
  }
  if (bigDay && bigDay.value > 0) {
    out.push({ emoji: '💥', label: 'Biggest single day', who: bigDay.rsn, value: fmtUnit(bigDay.value, type) });
  }

  const steady = mostConsistent(
    series.filter((s) => scoring.some((e) => e.rsn === s.rsn)),
    elapsed,
  );
  if (steady) {
    const total = steady.days.slice(0, elapsed).reduce((a, b) => a + b, 0);
    out.push({
      emoji: '⚖️',
      label: 'Most consistent',
      who: steady.rsn,
      value: `${fmtUnit(Math.round(total / elapsed), type)}/day`,
    });
  }

  const first = series.find((s) => (s.days[0] ?? 0) > 0);
  if (first) out.push({ emoji: '🌅', label: 'First to score', who: first.rsn, value: 'day one' });

  return out;
}

/** The viewer's clan-member ids, for the "you" strip. Empty when signed out. */
export async function viewerMemberIds(userId: number | null): Promise<number[]> {
  if (userId == null) return [];
  const rows = await db
    .select({ id: clanMembers.id })
    .from(clanMembers)
    .where(eq(clanMembers.userId, userId));
  return rows.map((r) => r.id);
}
