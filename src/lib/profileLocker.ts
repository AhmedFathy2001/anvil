import { db } from '@/db';
import { clanMembers, completions, events, eventSignups, memberDailyStats, playerEventFacts, eventParticipants, submissions, teams, tiles, weeklyCompetitions, weeklyParticipants } from '@/db/schema';
import { and, eq, gte, inArray, isNull, or } from 'drizzle-orm';
import { normalizeRsn } from '@/lib/auth';
import { BOSSES, EFFICIENCY_LABELS, SKILL_LABELS } from '@/lib/constants';
import { computeMemberBreakdown, rollupByOwner, type StatGainMap } from '@/lib/memberBreakdown';
import { getStatStandings, getTeamStandings } from '@/lib/statStandings';
import { parseContributionSnapshot } from '@/lib/statTracking';
import { loadPlayerOwners } from '@/lib/draftProfiles';
import { signupWindowState } from '@/lib/signup';
import { competitionIconUrl } from '@/lib/tileIcons';
import {
  getClanActivityAnalytics,
  getMemberProfile,
  getRecords,
  getUpcomingMilestones,
  listMembers,
  type PeriodRecord,
  type UpcomingMilestone,
} from '@/lib/memberProfile';

/**
 * Everything /profile shows, assembled once.
 *
 * The page used to be a settings form with an onboarding checklist on top: a member linked an
 * account, and then had no reason to open it again. Every number below already exists — the facts
 * written when an event ends, the weekly participant rows, the daily stats the sweep keeps — so this
 * is an assembly pass over data we have, not new tracking.
 *
 * It is deliberately staged. A member with nothing linked pays for almost none of it: without a
 * clan_member row there is no history, no standing and no board to score, so those queries never
 * run and the page is just the connect card.
 */

/** How many rows the history card carries. It's a highlight reel, not an archive. */
const HISTORY_LIMIT = 6;
/** Milestone bars in the rail. */
const MILESTONE_LIMIT = 4;
/** Daily rows to read for the activity streak. */
const STREAK_WINDOW_DAYS = 140;

export interface LockerAccount {
  id: number;
  rsn: string;
  isPrimary: boolean;
  verified: boolean;
  verificationMethod: string | null;
  provisional: boolean;
  /** In a live event, so it can't be unlinked (the API enforces the same rule). */
  inActiveEvent: boolean;
  /** Name of a live event this account is playing, for the account row's status line. */
  playingIn: string | null;
  /** Last plugin push, or null if this account has never talked to us. */
  lastPingAt: string | null;
}

export interface LockerConnection {
  /** True once any linked account has pushed live stats — i.e. the plugin is talking to us. */
  connected: boolean;
  lastPingAt: string | null;
  lastPingRsn: string | null;
}

export interface LockerCareer {
  eventsPlayed: number;
  eventWins: number;
  eventPodiums: number;
  weeklyWins: number;
  /** Career bingo points across every account, from the frozen per-event facts. */
  points: number;
  totalXp: number | null;
  /** Best clan placing across the member's accounts, on whichever metric they rank highest. */
  rank: { metric: 'EHB' | 'EHP' | 'XP'; place: number; outOf: number } | null;
  /** Consecutive weeks with XP gained, counting back from this week. 0 or 1 isn't a streak. */
  weekStreak: number;
}

export interface LockerLiveEvent {
  eventId: number;
  name: string;
  /** 'upcoming' = enrolled but the event hasn't started; there's no board to score yet. */
  status: 'live' | 'upcoming';
  startDate: string | null;
  endDate: string | null;
  playerToken: string | null;
  team: { id: number; name: string; color: string } | null;
  /** Team score against the whole board, and where that puts them. */
  score: number;
  total: number;
  unit: string;
  pct: number;
  rank: number | null;
  teamsTotal: number;
  /** This member's own share, by the same split the board and the MVP card use. */
  myPoints: number;
  myTasks: number;
}

export interface LockerLiveWeekly {
  id: number;
  title: string;
  kind: 'SOTW' | 'BOTW' | 'EOTW';
  metricLabel: string;
  iconUrl: string | null;
  endDate: string;
  gained: number;
  rank: number | null;
  entrants: number;
  /** Gain needed to pass the person one place above. Null when leading or unranked. */
  behind: number | null;
}

export interface LockerSignup {
  eventId: number;
  name: string;
  /** When sign-ups shut: the deadline, or failing that the start. */
  closesAt: string | null;
  /** The member's own sign-up, if they already sent one. */
  myStatus: string | null;
}

export interface LockerCaptainSeat {
  teamId: number;
  teamName: string;
  teamColor: string;
  eventId: number;
  eventName: string;
  players: number;
  ended: boolean;
}

export interface LockerHistoryRow {
  key: string;
  kind: 'event' | 'weekly';
  href: string;
  name: string;
  detail: string;
  /** Finishing place, when the format produced one. */
  place: number | null;
  outOf: number | null;
  value: string | null;
  endedOn: string | null;
}

export interface LockerTrophy {
  key: string;
  emoji: string;
  label: string;
  /** What earned it — "412 opened", "Winter Bingo". Null on a locked slot's hint. */
  value: string | null;
  /** Shown as a ×N badge when it happened more than once. */
  count: number | null;
  earned: boolean;
}

export interface LockerBests {
  records: PeriodRecord[];
  standings: { label: string; place: number; outOf: number }[];
}

export interface LockerData {
  accounts: LockerAccount[];
  connection: LockerConnection;
  /** True while the page's job is still "get this person connected". */
  setupNeeded: boolean;
  career: LockerCareer | null;
  liveEvents: LockerLiveEvent[];
  liveWeeklies: LockerLiveWeekly[];
  openSignups: LockerSignup[];
  captainSeats: LockerCaptainSeat[];
  history: LockerHistoryRow[];
  historyTotals: { events: number; weeklies: number };
  trophies: LockerTrophy[];
  bests: LockerBests | null;
  milestones: UpcomingMilestone[];
  /** The account the rail's personal numbers are about — records are per-account, not per-person. */
  focusRsn: string | null;
  /** Earliest join date across their accounts — how long they've been around. */
  memberSince: string | null;
}

const WEEKLY_KIND: Record<string, LockerLiveWeekly['kind']> = { skill: 'SOTW', boss: 'BOTW', efficiency: 'EOTW' };

function weeklyMetricLabel(type: string, metric: string): string {
  if (type === 'skill') return SKILL_LABELS[metric] ?? metric;
  if (type === 'efficiency') return EFFICIENCY_LABELS[metric] ?? metric.toUpperCase();
  return BOSSES.find((b) => b.key === metric)?.label ?? metric;
}

/** Monday-based week key, so a streak counts weeks the way a person does. */
function weekKey(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

export async function buildLocker(userId: number, now: Date = new Date()): Promise<LockerData> {
  const nowIso = now.toISOString();
  const nowMs = now.getTime();

  // ── Identity ──────────────────────────────────────────────────────────────────────────────────
  // Legacy federation anchors (`guest:<discordId>`) are relationships, not accounts — a colon can't
  // occur in an OSRS name, so the prefix is an unambiguous test. Federation is gone, but rows it
  // created can still be in the roster until the tenancy migration folds them in.
  const memberRows = (
    await db.query.clanMembers.findMany({
      where: and(eq(clanMembers.userId, userId), isNull(clanMembers.leftAt)),
      orderBy: (m, { desc }) => [desc(m.isPrimary), desc(m.verifiedAt)],
    })
  ).filter((m) => !m.rsn.startsWith('guest:'));

  const memberIds = memberRows.map((m) => m.id);
  const memberIdSet = new Set(memberIds);
  const myRsns = new Set(memberRows.map((m) => normalizeRsn(m.rsn)));
  for (const m of memberRows) {
    try {
      const prev = JSON.parse(m.previousRsns ?? '[]');
      if (Array.isArray(prev)) for (const p of prev) myRsns.add(normalizeRsn(String(p)));
    } catch {
      /* a malformed alias list shouldn't cost someone their history */
    }
  }

  // ── Connection ────────────────────────────────────────────────────────────────────────────────
  let lastPingAt: string | null = null;
  let lastPingRsn: string | null = null;
  for (const m of memberRows) {
    if (m.liveStatsAt && (!lastPingAt || m.liveStatsAt > lastPingAt)) {
      lastPingAt = m.liveStatsAt;
      lastPingRsn = m.rsn;
    }
  }
  const connection: LockerConnection = { connected: lastPingAt !== null, lastPingAt, lastPingRsn };
  const hasVerified = memberRows.some((m) => m.verifiedAt);
  const setupNeeded = memberRows.length === 0 || !hasVerified;

  // A member with nothing linked has no history to read, no board to score and no standing to hold.
  // Everything below this point is keyed on their clan_member rows, so stop here rather than run a
  // dozen queries that can only return empty.
  if (memberIds.length === 0) {
    return {
      accounts: [],
      connection,
      setupNeeded: true,
      career: null,
      liveEvents: [],
      liveWeeklies: [],
      openSignups: await openSignupsFor(userId, nowMs),
      captainSeats: await captainSeatsFor(userId, nowIso),
      history: [],
      historyTotals: { events: 0, weeklies: 0 },
      trophies: lockedTrophies([]),
      bests: null,
      milestones: [],
      focusRsn: null,
      memberSince: null,
    };
  }

  // ── Enrollment: which events these accounts are in, live and finished ─────────────────────────
  const playerRows = await db
    .select({
      id: eventParticipants.id,
      name: eventParticipants.name,
      clanMemberId: eventParticipants.clanMemberId,
      teamId: eventParticipants.teamId,
      eventId: eventParticipants.eventId,
      playerToken: eventParticipants.playerToken,
      eventName: events.name,
      eventStartDate: events.startDate,
      eventEndDate: events.endDate,
      eventForceEndedAt: events.forceEndedAt,
      eventFormat: events.format,
      eventScoringMode: events.scoringMode,
      teamName: teams.name,
      teamColor: teams.color,
    })
    .from(eventParticipants)
    .innerJoin(events, eq(eventParticipants.eventId, events.id))
    .leftJoin(teams, eq(eventParticipants.teamId, teams.id))
    .where(inArray(eventParticipants.clanMemberId, memberIds));

  const isOver = (row: { eventForceEndedAt: string | null; eventEndDate: string | null }) =>
    !!row.eventForceEndedAt || (!!row.eventEndDate && row.eventEndDate < nowIso);
  // A host still building an event gives it no start date, which is what keeps it off every public
  // surface (lib/eventCards). Being drafted into one is not a fact about the member yet, so it must
  // not name their account's status, count toward their history, or appear on this page at all.
  const isDraft = (row: { eventForceEndedAt: string | null; eventStartDate: string | null }) =>
    !row.eventForceEndedAt && !row.eventStartDate;
  const myLivePlayers = playerRows.filter((p) => !isOver(p));
  // Remove-gating mirrors the API's own rule (not force-ended, not past its end), drafts included —
  // offering a Remove the server will refuse is worse than one disabled button.
  const activeMemberIds = new Set(myLivePlayers.map((p) => p.clanMemberId));
  const liveEventNameByMember = new Map<number, string>();
  for (const p of myLivePlayers) {
    if (p.clanMemberId == null || isDraft(p)) continue;
    if (p.eventStartDate && p.eventStartDate > nowIso) continue; // enrolled, not playing yet
    liveEventNameByMember.set(p.clanMemberId, p.eventName);
  }

  const accounts: LockerAccount[] = memberRows.map((m) => ({
    id: m.id,
    rsn: m.rsn,
    isPrimary: m.isPrimary === 1,
    verified: Boolean(m.verifiedAt),
    verificationMethod: m.verificationMethod,
    provisional: Boolean(m.provisional),
    inActiveEvent: activeMemberIds.has(m.id),
    playingIn: liveEventNameByMember.get(m.id) ?? null,
    lastPingAt: m.liveStatsAt,
  }));

  // ── Live events: the team's board, and this member's share of it ──────────────────────────────
  // A host still building an event has no start date and it isn't public yet — being drafted into
  // one is not something to tell the member about. Anything else they're enrolled in is either
  // running or about to, and both are worth a row (with different countdowns).
  const liveEvents: LockerLiveEvent[] = [];
  const liveEventIds = [...new Set(myLivePlayers.filter((p) => !isDraft(p) && p.eventStartDate).map((p) => p.eventId))];
  for (const eventId of liveEventIds) {
    const mine = myLivePlayers.filter((p) => p.eventId === eventId);
    const lead = mine.find((p) => p.teamId != null) ?? mine[0];
    const started = !!lead.eventStartDate && lead.eventStartDate <= nowIso;
    const base = {
      eventId,
      name: lead.eventName,
      status: (started ? 'live' : 'upcoming') as LockerLiveEvent['status'],
      startDate: lead.eventStartDate,
      endDate: lead.eventEndDate,
      playerToken: lead.playerToken,
    };
    // No team yet, or no board yet: there is nothing of theirs to score, so don't imply there is.
    if (!lead.teamId || !started) {
      liveEvents.push({
        ...base,
        team:
          lead.teamId != null
            ? { id: lead.teamId, name: lead.teamName ?? 'Your team', color: lead.teamColor ?? '#d4a017' }
            : null,
        score: 0,
        total: 0,
        unit: 'tiles',
        pct: 0,
        rank: null,
        teamsTotal: 0,
        myPoints: 0,
        myTasks: 0,
      });
      continue;
    }

    const standings = await getTeamStandings(eventId, lead.eventScoringMode ?? 'classic');
    const index = standings.findIndex((s) => s.teamId === lead.teamId);
    const standing = index >= 0 ? standings[index] : null;
    const mineByPlayerId = new Set(mine.map((p) => p.id));
    const { points, tasks } = await myShareOfEvent({
      eventId,
      teamId: lead.teamId,
      scoringMode: lead.eventScoringMode,
      myPlayerIds: mineByPlayerId,
    });

    liveEvents.push({
      ...base,
      team: { id: lead.teamId, name: lead.teamName ?? 'Your team', color: lead.teamColor ?? '#d4a017' },
      score: standing?.score ?? 0,
      total: standing?.total ?? 0,
      unit: standing?.unit ?? 'tiles',
      pct: standing?.pct ?? 0,
      rank: index >= 0 ? index + 1 : null,
      teamsTotal: standings.length,
      myPoints: points,
      myTasks: tasks,
    });
  }
  liveEvents.sort(
    (a, b) =>
      Number(a.status === 'upcoming') - Number(b.status === 'upcoming') ||
      (a.endDate ?? '9999').localeCompare(b.endDate ?? '9999'),
  );

  // ── Live weeklies: where this person sits, and what would move them up ────────────────────────
  const activeComps = await db.query.weeklyCompetitions.findMany({
    where: eq(weeklyCompetitions.status, 'active'),
  });
  const liveWeeklies: LockerLiveWeekly[] = [];
  if (activeComps.length > 0) {
    const partRows = await db
      .select({
        competitionId: weeklyParticipants.competitionId,
        clanMemberId: weeklyParticipants.clanMemberId,
        rsn: weeklyParticipants.rsn,
        baselineValue: weeklyParticipants.baselineValue,
        currentValue: weeklyParticipants.currentValue,
      })
      .from(weeklyParticipants)
      .where(inArray(weeklyParticipants.competitionId, activeComps.map((c) => c.id)));

    for (const comp of activeComps) {
      const ranked = partRows
        .filter((p) => p.competitionId === comp.id)
        .map((p) => ({ ...p, gained: (p.currentValue ?? 0) - (p.baselineValue ?? 0) }))
        .sort((a, b) => b.gained - a.gained);
      const mineIdx = ranked.findIndex(
        (p) => (p.clanMemberId != null && memberIdSet.has(p.clanMemberId)) || myRsns.has(normalizeRsn(p.rsn)),
      );
      if (mineIdx === -1) continue; // not entered — nothing to say about their placing
      const me = ranked[mineIdx];
      const scoring = ranked.filter((p) => p.gained > 0);
      liveWeeklies.push({
        id: comp.id,
        title: comp.title,
        kind: WEEKLY_KIND[comp.type] ?? 'SOTW',
        metricLabel: weeklyMetricLabel(comp.type, comp.metric),
        iconUrl: competitionIconUrl(comp.type === 'boss' ? 'boss' : 'skill', comp.metric),
        endDate: comp.endDate,
        gained: me.gained,
        // Rank only means something once they're on the board; before that the honest answer is
        // "entered, nothing gained yet" rather than a place among people who also have nothing.
        rank: me.gained > 0 ? mineIdx + 1 : null,
        entrants: scoring.length,
        behind: mineIdx > 0 ? Math.max(0, ranked[mineIdx - 1].gained - me.gained) : null,
      });
    }
  }

  // ── Career, history and trophies ──────────────────────────────────────────────────────────────
  // Mine, plus any row that lost its member id (a merged or deleted clan_member sets it null) so the
  // alias pass below can still claim an old RSN of theirs. Everyone else's rows are the bulk of the
  // table and are never a match, so they don't need reading.
  const factRows = await db
    .select({
      eventId: playerEventFacts.eventId,
      clanMemberId: playerEventFacts.clanMemberId,
      rsn: playerEventFacts.rsn,
      points: playerEventFacts.points,
      tilesContributed: playerEventFacts.tilesContributed,
      teamRank: playerEventFacts.teamRank,
      teamsTotal: playerEventFacts.teamsTotal,
      name: events.name,
      endDate: events.endDate,
      format: events.format,
    })
    .from(playerEventFacts)
    .innerJoin(events, eq(playerEventFacts.eventId, events.id))
    .where(or(inArray(playerEventFacts.clanMemberId, memberIds), isNull(playerEventFacts.clanMemberId)));
  const myFacts = new Map<number, (typeof factRows)[number]>();
  for (const f of factRows) {
    if ((f.clanMemberId != null && memberIdSet.has(f.clanMemberId)) || myRsns.has(normalizeRsn(f.rsn))) {
      myFacts.set(f.eventId, f);
    }
  }

  // Played = enrolled ∪ has facts. Facts are written when an event ends, so an older bingo has none;
  // enrollment survives either way, and an admin "remove from event" drops the player row but not
  // the fact. Either alone under-counts a real history.
  const playedEventIds = new Set<number>([
    ...playerRows.filter((p) => !isDraft(p)).map((p) => p.eventId),
    ...myFacts.keys(),
  ]);
  const finishedEvents = [...playedEventIds]
    .map((id) => {
      const fact = myFacts.get(id);
      const enrolled = playerRows.find((p) => p.eventId === id);
      const endDate = fact?.endDate ?? enrolled?.eventEndDate ?? null;
      const forceEnded = enrolled?.eventForceEndedAt ?? null;
      const over = !!forceEnded || (!!endDate && endDate < nowIso);
      return {
        eventId: id,
        name: fact?.name ?? enrolled?.eventName ?? 'Event',
        endedOn: endDate,
        over,
        points: fact?.points ?? null,
        tiles: fact?.tilesContributed ?? null,
        teamRank: fact?.teamRank ?? null,
        teamsTotal: fact?.teamsTotal ?? null,
        format: fact?.format ?? enrolled?.eventFormat ?? null,
      };
    })
    .filter((e) => e.over)
    .sort((a, b) => (b.endedOn ?? '').localeCompare(a.endedOn ?? ''));

  const finishedWeeklies = await finishedWeekliesFor(memberIdSet, myRsns);

  const history: LockerHistoryRow[] = [
    ...finishedEvents.map((e) => ({
      key: `e${e.eventId}`,
      kind: 'event' as const,
      href: `/events/${e.eventId}`,
      name: e.name,
      detail:
        e.teamsTotal != null
          ? `${e.teamsTotal} team${e.teamsTotal === 1 ? '' : 's'}`
          : e.tiles != null
            ? `${e.tiles} tile${e.tiles === 1 ? '' : 's'}`
            : 'played',
      place: e.teamRank,
      outOf: e.teamsTotal,
      value: e.points != null && e.points > 0 ? `${Math.round(e.points).toLocaleString()} pts` : null,
      endedOn: e.endedOn,
    })),
    ...finishedWeeklies.map((w) => ({
      key: `w${w.competitionId}`,
      kind: 'weekly' as const,
      href: `/weekly/${w.competitionId}`,
      name: w.title,
      detail: `${w.entrants} entrant${w.entrants === 1 ? '' : 's'}`,
      place: w.rank,
      outOf: w.entrants,
      value: `${w.gained.toLocaleString()} ${w.type === 'boss' ? 'KC' : 'XP'}`,
      endedOn: w.endedOn,
    })),
  ].sort((a, b) => (b.endedOn ?? '').localeCompare(a.endedOn ?? ''));

  const eventWins = finishedEvents.filter((e) => e.teamRank === 1).length;
  const eventPodiums = finishedEvents.filter((e) => e.teamRank != null && e.teamRank <= 3).length;
  const weeklyWins = finishedWeeklies.filter((w) => w.rank === 1).length;

  // ── Standing in the clan ──────────────────────────────────────────────────────────────────────
  const roster = await listMembers();
  const rankIn = (pick: (r: (typeof roster)[number]) => number | null) => {
    const ranked = roster.filter((r) => pick(r) != null).sort((a, b) => (pick(b) ?? 0) - (pick(a) ?? 0));
    let best: { place: number; outOf: number } | null = null;
    for (const id of memberIds) {
      const index = ranked.findIndex((r) => r.id === id);
      if (index >= 0 && (!best || index + 1 < best.place)) best = { place: index + 1, outOf: ranked.length };
    }
    return best;
  };
  const ehbRank = rankIn((r) => r.ehb);
  const ehpRank = rankIn((r) => r.ehp);
  const xpRank = rankIn((r) => r.overallXp);
  // Lead with whichever placing is actually good — a boss-focused member's #2 EHB says more than
  // their #40 total XP, and the rail lists all three anyway.
  const bestRank = [
    ehbRank && { metric: 'EHB' as const, ...ehbRank },
    ehpRank && { metric: 'EHP' as const, ...ehpRank },
    xpRank && { metric: 'XP' as const, ...xpRank },
  ]
    .filter((r): r is { metric: 'EHB' | 'EHP' | 'XP'; place: number; outOf: number } => !!r)
    .sort((a, b) => a.place - b.place)[0] ?? null;

  const myRoster = roster.filter((r) => memberIdSet.has(r.id));
  const totalXp = myRoster.reduce((sum, r) => sum + (r.overallXp ?? 0), 0) || null;

  // ── Week streak ───────────────────────────────────────────────────────────────────────────────
  const streakFrom = new Date(nowMs - STREAK_WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10);
  const dailyRows = await db
    .select({ day: memberDailyStats.day, xpGained: memberDailyStats.xpGained })
    .from(memberDailyStats)
    .where(and(inArray(memberDailyStats.clanMemberId, memberIds), gte(memberDailyStats.day, streakFrom)));
  const activeWeeks = new Set(dailyRows.filter((r) => r.xpGained > 0).map((r) => weekKey(r.day)));
  let weekStreak = 0;
  // Start from last week when this week is still empty — a Monday morning shouldn't reset a streak
  // someone has been holding for two months.
  const thisWeek = weekKey(nowIso.slice(0, 10));
  let cursor = new Date(`${thisWeek}T00:00:00Z`);
  if (!activeWeeks.has(thisWeek)) cursor = new Date(cursor.getTime() - 7 * 86_400_000);
  while (activeWeeks.has(cursor.toISOString().slice(0, 10))) {
    weekStreak += 1;
    cursor = new Date(cursor.getTime() - 7 * 86_400_000);
  }

  const career: LockerCareer = {
    eventsPlayed: playedEventIds.size,
    eventWins,
    eventPodiums,
    weeklyWins,
    points: [...myFacts.values()].reduce((sum, f) => sum + (f.points ?? 0), 0),
    totalXp,
    rank: bestRank,
    weekStreak,
  };

  // ── The rail's personal numbers ───────────────────────────────────────────────────────────────
  // Records and milestones are per-ACCOUNT — a best week is one account's best week, and summing an
  // alt's XP into it would invent a week nobody played. Focus the account that leads the person.
  const focus =
    memberRows.find((m) => m.isPrimary === 1) ??
    myRoster.slice().sort((a, b) => (b.overallXp ?? 0) - (a.overallXp ?? 0))[0] ??
    memberRows[0];
  const focusRsn = focus?.rsn ?? null;
  const focusId = focus?.id ?? null;

  const [records, focusProfile, activity] = await Promise.all([
    focusId ? getRecords(focusId) : Promise.resolve([]),
    focusRsn ? getMemberProfile(focusRsn) : Promise.resolve(null),
    getClanActivityAnalytics(),
  ]);

  const bests: LockerBests = {
    records,
    standings: [
      ehpRank && { label: 'EHP in clan', ...ehpRank },
      ehbRank && { label: 'EHB in clan', ...ehbRank },
      xpRank && { label: 'Total XP', ...xpRank },
    ].filter((s): s is { label: string; place: number; outOf: number } => !!s),
  };

  const milestones = focusProfile ? getUpcomingMilestones(focusProfile, MILESTONE_LIMIT) : [];

  // ── Trophies ──────────────────────────────────────────────────────────────────────────────────
  const earned: LockerTrophy[] = [];
  if (eventWins > 0) {
    const first = finishedEvents.find((e) => e.teamRank === 1);
    earned.push({
      key: 'event-win',
      emoji: '🏆',
      label: 'Event won',
      value: first?.name ?? null,
      count: eventWins > 1 ? eventWins : null,
      earned: true,
    });
  }
  if (eventPodiums > 0) {
    earned.push({
      key: 'podium',
      emoji: '🥈',
      label: 'Podium',
      value: 'top 3 finish',
      count: eventPodiums > 1 ? eventPodiums : null,
      earned: true,
    });
  }
  if (weeklyWins > 0) {
    const first = finishedWeeklies.find((w) => w.rank === 1);
    earned.push({
      key: 'weekly-win',
      emoji: '⚡',
      label: 'Weekly won',
      // A trophy tile is a few characters wide, and every weekly title starts with the same six
      // words. The metric after the dash is the part that identifies it.
      value: first ? first.title.split('—').pop()!.trim() : null,
      count: weeklyWins > 1 ? weeklyWins : null,
      earned: true,
    });
  }
  const nines = focusProfile?.skills.filter((s) => s.level >= 99).length ?? 0;
  if (nines > 0) {
    earned.push({
      key: 'nines',
      emoji: '🎖️',
      label: nines === 1 ? '99 earned' : '99s earned',
      value: focusRsn,
      count: nines > 1 ? nines : null,
      earned: true,
    });
  }
  // Clan titles this person currently holds. Cosmetic and clan-wide — exactly the kind of thing
  // worth a trophy, and the only one here somebody else can take off them.
  for (const title of activity.titles) {
    if (!myRsns.has(normalizeRsn(title.rsn))) continue;
    earned.push({
      key: `title-${title.key}`,
      emoji: title.emoji,
      label: title.title,
      value: title.value,
      count: null,
      earned: true,
    });
  }

  return {
    accounts,
    connection,
    setupNeeded,
    career,
    liveEvents,
    liveWeeklies,
    openSignups: await openSignupsFor(userId, nowMs, new Set(playerRows.map((p) => p.eventId))),
    captainSeats: await captainSeatsFor(userId, nowIso),
    history: history.slice(0, HISTORY_LIMIT),
    historyTotals: { events: finishedEvents.length, weeklies: finishedWeeklies.length },
    trophies: lockedTrophies(earned),
    bests,
    milestones,
    focusRsn,
    memberSince: memberRows.map((m) => m.joinedAt).sort()[0] ?? null,
  };
}

/**
 * This member's share of their team's board, by the same split the scoreboard and the MVP card use.
 *
 * Deliberately the shared derivation rather than a cheaper count of their own submissions: a stat
 * tile finished by the hiscores sweep has no submission at all, and a number here that disagreed
 * with the one on the board would be worse than no number.
 */
async function myShareOfEvent(params: {
  eventId: number;
  teamId: number;
  scoringMode: string | null;
  myPlayerIds: Set<number>;
}): Promise<{ points: number; tasks: number }> {
  const { eventId, teamId, scoringMode, myPlayerIds } = params;

  const [eventTiles, eventPlayers] = await Promise.all([
    db.select().from(tiles).where(eq(tiles.eventId, eventId)),
    db.select().from(eventParticipants).where(eq(eventParticipants.eventId, eventId)),
  ]);
  const tileIds = eventTiles.map((t) => t.id);
  if (tileIds.length === 0) return { points: 0, tasks: 0 };

  const [rawCompletions, eventSubmissions, statStandings] = await Promise.all([
    db.select().from(completions).where(inArray(completions.tileId, tileIds)),
    db
      .select({
        tileId: submissions.tileId,
        teamId: submissions.teamId,
        creditPlayerId: submissions.creditPlayerId,
        amount: submissions.amount,
      })
      .from(submissions)
      .where(inArray(submissions.tileId, tileIds)),
    getStatStandings(eventId),
  ]);

  const statGains: StatGainMap = {};
  for (const s of statStandings) {
    statGains[s.tileId] = s.players.map((pl) => ({ playerId: pl.playerId, gained: pl.gained }));
  }

  const breakdown = computeMemberBreakdown({
    teamId,
    scoringMode,
    players: eventPlayers,
    tiles: eventTiles,
    completions: rawCompletions.map((c) => ({
      id: c.id,
      teamId: c.teamId,
      tileId: c.tileId,
      completedAt: c.completedAt,
      creditPlayerId: c.creditPlayerId,
      statContributions: parseContributionSnapshot(c.statContributions),
      awardedPoints: c.awardedPoints,
    })),
    submissions: eventSubmissions,
    statGains,
  });

  // On a per-person event the member's alts share one slot, so roll them together before reading
  // the row off — otherwise a two-account player sees half their own score.
  const event = await db.query.events.findFirst({
    where: eq(events.id, eventId),
    columns: { accountSlotMode: true },
  });
  const rows =
    event?.accountSlotMode === 'per-person'
      ? rollupByOwner(breakdown, await loadPlayerOwners(eventPlayers))
      : breakdown;

  let points = 0;
  let tasks = 0;
  for (const row of rows) {
    if (!myPlayerIds.has(row.playerId)) continue;
    points += row.points;
    tasks += row.tasks;
  }
  return { points: Math.round(points), tasks };
}

/** Finished weeklies these accounts scored in, with their placing among people who actually moved. */
async function finishedWeekliesFor(memberIdSet: Set<number>, myRsns: Set<string>) {
  const mine = await db
    .select({ competitionId: weeklyParticipants.competitionId })
    .from(weeklyParticipants)
    .innerJoin(weeklyCompetitions, eq(weeklyParticipants.competitionId, weeklyCompetitions.id))
    .where(
      and(
        inArray(weeklyParticipants.clanMemberId, [...memberIdSet]),
        eq(weeklyCompetitions.status, 'completed'),
      ),
    );
  const compIds = [...new Set(mine.map((m) => m.competitionId))];
  if (compIds.length === 0) return [];

  const [comps, allParticipants] = await Promise.all([
    db.query.weeklyCompetitions.findMany({ where: inArray(weeklyCompetitions.id, compIds) }),
    db
      .select({
        competitionId: weeklyParticipants.competitionId,
        clanMemberId: weeklyParticipants.clanMemberId,
        rsn: weeklyParticipants.rsn,
        baselineValue: weeklyParticipants.baselineValue,
        currentValue: weeklyParticipants.currentValue,
      })
      .from(weeklyParticipants)
      .where(inArray(weeklyParticipants.competitionId, compIds)),
  ]);

  const out: { competitionId: number; title: string; type: string; endedOn: string; gained: number; rank: number; entrants: number }[] = [];
  for (const comp of comps) {
    // Only entrants who actually moved are ranked — a comp of 80 enrolled and 6 active shouldn't
    // report "8th of 80" as if 74 people were beaten. Mirrors getCompetitionHistory.
    const field = allParticipants
      .filter((p) => p.competitionId === comp.id)
      .map((p) => ({ ...p, gained: (p.currentValue ?? 0) - (p.baselineValue ?? 0) }))
      .filter((p) => p.gained > 0)
      .sort((a, b) => b.gained - a.gained);
    const index = field.findIndex(
      (p) => (p.clanMemberId != null && memberIdSet.has(p.clanMemberId)) || myRsns.has(normalizeRsn(p.rsn)),
    );
    if (index === -1) continue; // entered but never scored
    out.push({
      competitionId: comp.id,
      title: comp.title,
      type: comp.type,
      endedOn: comp.endDate,
      gained: field[index].gained,
      rank: index + 1,
      entrants: field.length,
    });
  }
  return out.sort((a, b) => b.endedOn.localeCompare(a.endedOn));
}

/** Events whose sign-ups are open, with this user's own sign-up state where they've sent one. */
async function openSignupsFor(
  userId: number,
  nowMs: number,
  alreadyIn: Set<number> = new Set(),
): Promise<LockerSignup[]> {
  const all = await db.select().from(events);
  const open = all.filter((e) => {
    if (e.forceEndedAt) return false;
    if (!e.startDate) return false; // a draft the host is still building isn't public
    if (e.endDate && new Date(e.endDate).getTime() < nowMs) return false;
    // Already enrolled (drafted, or added by an admin) — the window may still be open for everyone
    // else, but telling someone who is on a team to sign up is just wrong.
    if (alreadyIn.has(e.id)) return false;
    return signupWindowState(e).open;
  });
  if (open.length === 0) return [];

  const mine = await db
    .select({ eventId: eventSignups.eventId, status: eventSignups.status })
    .from(eventSignups)
    .where(and(eq(eventSignups.userId, userId), inArray(eventSignups.eventId, open.map((e) => e.id))));
  const statusByEvent = new Map(mine.map((s) => [s.eventId, s.status]));

  return open
    .map((e) => ({
      eventId: e.id,
      name: e.name,
      closesAt: e.signupDeadline ?? e.startDate,
      myStatus: statusByEvent.get(e.id) ?? null,
    }))
    .sort((a, b) => (a.closesAt ?? '9999').localeCompare(b.closesAt ?? '9999'));
}

/** Teams this user captains, newest first, with live ones ahead of finished ones. */
async function captainSeatsFor(userId: number, nowIso: string): Promise<LockerCaptainSeat[]> {
  const seats = await db
    .select({
      teamId: teams.id,
      teamName: teams.name,
      teamColor: teams.color,
      eventId: events.id,
      eventName: events.name,
      eventEndDate: events.endDate,
      eventForceEndedAt: events.forceEndedAt,
    })
    .from(teams)
    .innerJoin(events, eq(teams.eventId, events.id))
    .where(eq(teams.captainUserId, userId));
  if (seats.length === 0) return [];

  const counts = await db
    .select({ teamId: eventParticipants.teamId })
    .from(eventParticipants)
    .where(inArray(eventParticipants.teamId, seats.map((s) => s.teamId)));
  const sizeByTeam = new Map<number, number>();
  for (const row of counts) {
    if (row.teamId != null) sizeByTeam.set(row.teamId, (sizeByTeam.get(row.teamId) ?? 0) + 1);
  }

  return seats
    .map((s) => ({
      teamId: s.teamId,
      teamName: s.teamName,
      teamColor: s.teamColor,
      eventId: s.eventId,
      eventName: s.eventName,
      players: sizeByTeam.get(s.teamId) ?? 0,
      ended: !!s.eventForceEndedAt || (!!s.eventEndDate && s.eventEndDate < nowIso),
    }))
    .sort((a, b) => Number(a.ended) - Number(b.ended));
}

/** The catalogue behind the empty slots — what's collectable, so an empty case still says something. */
const LOCKED_CATALOGUE: { key: string; emoji: string; label: string; hint: string }[] = [
  { key: 'event-win', emoji: '🏆', label: 'Event won', hint: 'win a bingo' },
  { key: 'podium', emoji: '🥈', label: 'Podium', hint: 'finish top 3' },
  { key: 'weekly-win', emoji: '⚡', label: 'Weekly won', hint: 'win a SOTW' },
  { key: 'nines', emoji: '🎖️', label: '99s earned', hint: 'max a skill' },
  { key: 'title', emoji: '👑', label: 'A clan title', hint: 'lead an activity' },
];

/** Pad the earned trophies with locked slots so the case reads as a set, not a tally. */
function lockedTrophies(earned: LockerTrophy[]): LockerTrophy[] {
  const held = new Set(earned.map((t) => (t.key.startsWith('title-') ? 'title' : t.key)));
  const locked = LOCKED_CATALOGUE.filter((c) => !held.has(c.key)).map((c) => ({
    key: `locked-${c.key}`,
    emoji: c.emoji,
    label: c.label,
    value: c.hint,
    count: null,
    earned: false,
  }));
  return [...earned, ...locked];
}
