import { db } from '@/db';
import { events, teams, tiles, players, completions, submissions, clanMembers, playerEventFacts } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { computeMemberBreakdown, type StatGainMap } from '@/lib/memberBreakdown';
import { getStatStandings } from '@/lib/statStandings';
import { parseContributionSnapshot, type StatContributionSnapshot } from '@/lib/statTracking';
import { isEventEnded } from '@/lib/survey';
import { parseEventRules } from '@/lib/eventRules';
import { scoreTeams } from '@/lib/boardScoring';

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// player_event_facts materializer — Phase 2 of the balance-engine plan. One row per PERSON per
// finished event: points (via the exact split the scoreboard/MVP trusts), tile/submission tallies,
// recap counters, the drop-off timeline, and team context. The longitudinal player profile folds
// over these rows; the draft advisory and balance modes read the fold.
//
// Person identity is DURABLE across events (unlike per-event player ids): linked user
// ('u<userId>') > clan member ('m<clanMemberId>') > bare normalized RSN ('n<rsn>'). Legacy player
// rows with no clanMemberId (pre-backfill events) resolve through the clan_members RSN alias map
// (current + previous RSNs) — the July backtest showed that without this, cross-event history
// simply doesn't link.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

const normalizeRsn = (name: string) => name.toLowerCase().replaceAll('-', ' ').replaceAll('_', ' ').trim();

interface PersonIdentity {
  key: string;
  clanMemberId: number | null;
  userId: number | null;
}

/** Build resolver: player row → durable person identity, via member link else RSN alias. */
async function buildIdentityResolver(): Promise<(clanMemberId: number | null, name: string) => PersonIdentity> {
  const members = await db
    .select({
      id: clanMembers.id,
      userId: clanMembers.userId,
      rsnNormalized: clanMembers.rsnNormalized,
      previousRsns: clanMembers.previousRsns,
    })
    .from(clanMembers);
  const byId = new Map(members.map((m) => [m.id, m]));
  const byAlias = new Map<string, (typeof members)[number]>();
  for (const m of members) {
    const aliases = [m.rsnNormalized];
    try {
      const prev = JSON.parse(m.previousRsns ?? '[]');
      if (Array.isArray(prev)) aliases.push(...prev.map((r) => normalizeRsn(String(r))));
    } catch {
      /* ignore malformed history */
    }
    for (const a of aliases) if (a && !byAlias.has(a)) byAlias.set(a, m);
  }
  return (clanMemberId, name) => {
    const member = clanMemberId != null ? byId.get(clanMemberId) : byAlias.get(normalizeRsn(name));
    if (!member) return { key: `n${normalizeRsn(name)}`, clanMemberId: null, userId: null };
    return {
      key: member.userId != null ? `u${member.userId}` : `m${member.id}`,
      clanMemberId: member.id,
      userId: member.userId ?? null,
    };
  };
}

export interface PlayerEventFactsRow {
  eventId: number;
  personKey: string;
  clanMemberId: number | null;
  userId: number | null;
  rsn: string;
  accounts: number;
  teamId: number;
  points: number;
  tilesContributed: number;
  tilesFinished: number;
  submissions: number;
  xpGained: number;
  kcGained: number;
  deaths: number;
  lootGpGained: number;
  pvpKills: number;
  activeDays: number;
  lastActiveDay: number | null;
  eventDays: number | null;
  subbedOut: boolean;
  teamRank: number;
  teamsTotal: number;
  teamPoints: number;
  topTeamPoints: number;
}

/** Compute the per-person facts for one event. Pure read — writePlayerEventFacts persists. */
export async function computePlayerEventFacts(eventId: number): Promise<PlayerEventFactsRow[] | null> {
  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event) return null;

  const [eventTeams, eventTiles, eventPlayers] = await Promise.all([
    db.select().from(teams).where(eq(teams.eventId, eventId)),
    db.select().from(tiles).where(eq(tiles.eventId, eventId)),
    db.select().from(players).where(eq(players.eventId, eventId)),
  ]);
  const tileIds = eventTiles.map((t) => t.id);
  const eventCompletions = tileIds.length
    ? (await db.select().from(completions).where(inArray(completions.tileId, tileIds))).map((c) => ({
        teamId: c.teamId,
        tileId: c.tileId,
        creditPlayerId: c.creditPlayerId,
        awardedPoints: c.awardedPoints,
        statContributions: parseContributionSnapshot(c.statContributions) as StatContributionSnapshot | null,
      }))
    : [];
  const eventSubmissions = tileIds.length
    ? await db
        .select({
          tileId: submissions.tileId,
          teamId: submissions.teamId,
          creditPlayerId: submissions.creditPlayerId,
          amount: submissions.amount,
          createdAt: submissions.createdAt,
        })
        .from(submissions)
        .where(inArray(submissions.tileId, tileIds))
    : [];

  const statStandings = await getStatStandings(eventId);
  const statGains: StatGainMap = {};
  const statTypeByTile = new Map<number, string>();
  for (const st of statStandings) {
    statGains[st.tileId] = st.players.map((pl) => ({ playerId: pl.playerId, gained: pl.gained }));
    statTypeByTile.set(st.tileId, st.statType);
  }

  const resolve = await buildIdentityResolver();

  // Per-team member breakdown — the same math the scoreboard/MVP surfaces trust.
  const contributionByPlayer = new Map<number, { points: number; tiles: Set<number>; submissions: number }>();
  for (const team of eventTeams) {
    const breakdown = computeMemberBreakdown({
      teamId: team.id,
      scoringMode: event.scoringMode,
      players: eventPlayers,
      tiles: eventTiles,
      completions: eventCompletions,
      submissions: eventSubmissions.map((s) => ({
        teamId: s.teamId,
        tileId: s.tileId,
        creditPlayerId: s.creditPlayerId,
        amount: s.amount,
      })),
      statGains,
    });
    for (const m of breakdown) {
      contributionByPlayer.set(m.playerId, {
        points: m.points,
        tiles: new Set(m.contributions.map((c) => c.tileId)),
        submissions: m.submissions,
      });
    }
  }

  // Team totals + ranks (the app's own scoring: frozen award else weight in points mode, count in
  // tiles mode) for the collapse context. Optional tiles never score, and reveal-policy events
  // only count tiles that actually went live — exact mirror of the lifecycle standings math.
  const rules = parseEventRules(event.rules);
  const teamPointsMap = new Map<number, number>(
    scoreTeams({
      scoringMode: event.scoringMode,
      rules,
      tiles: eventTiles,
      completions: eventCompletions,
      teams: eventTeams,
    }).map((s) => [s.teamId, s.score]),
  );
  const rankedTeams = [...teamPointsMap.entries()].sort((a, b) => b[1] - a[1]);
  const teamRank = new Map(rankedTeams.map(([tid], i) => [tid, i + 1]));
  const topTeamPoints = rankedTeams[0]?.[1] ?? 0;

  // Timeline: 1-based day index of each credited submission → activeDays / lastActiveDay. Stat-tile
  // grinders may have no submissions; their activity shows in xp/kcGained instead (a known gap the
  // sweep can't backfill — noted, not faked).
  const startMs = event.startDate ? Date.parse(event.startDate) : NaN;
  const endIso = event.forceEndedAt ?? event.endDate ?? null;
  const eventDays =
    Number.isFinite(startMs) && endIso ? Math.max(1, Math.round((Date.parse(endIso) - startMs) / 86_400_000)) : null;
  const daysByPlayer = new Map<number, Set<number>>();
  if (Number.isFinite(startMs)) {
    for (const s of eventSubmissions) {
      if (s.creditPlayerId == null) continue;
      const day = Math.floor((Date.parse(s.createdAt) - startMs) / 86_400_000) + 1;
      if (!Number.isFinite(day) || day < 1) continue;
      let set = daysByPlayer.get(s.creditPlayerId);
      if (!set) daysByPlayer.set(s.creditPlayerId, (set = new Set()));
      set.add(day);
    }
  }

  // Fold player rows into persons. Rows with no team (removed mid-event) are skipped — they're not
  // part of the event outcome the profile should learn from.
  interface Acc extends PlayerEventFactsRow {
    days: Set<number>;
    frozenRows: number;
    tiles: Set<number>;
  }
  const byPerson = new Map<string, Acc>();
  for (const p of eventPlayers) {
    if (p.teamId == null) continue;
    const identity = resolve(p.clanMemberId, p.name);
    let acc = byPerson.get(identity.key);
    if (!acc) {
      byPerson.set(
        identity.key,
        (acc = {
          eventId,
          personKey: identity.key,
          clanMemberId: identity.clanMemberId,
          userId: identity.userId,
          rsn: p.name,
          accounts: 0,
          teamId: p.teamId,
          points: 0,
          tilesContributed: 0,
          tilesFinished: 0,
          submissions: 0,
          xpGained: 0,
          kcGained: 0,
          deaths: 0,
          lootGpGained: 0,
          pvpKills: 0,
          activeDays: 0,
          lastActiveDay: null,
          eventDays,
          subbedOut: false,
          teamRank: teamRank.get(p.teamId) ?? 0,
          teamsTotal: eventTeams.length,
          teamPoints: teamPointsMap.get(p.teamId) ?? 0,
          topTeamPoints,
          days: new Set<number>(),
          frozenRows: 0,
          tiles: new Set<number>(),
        }),
      );
    }
    acc.accounts += 1;
    if (p.frozenAt != null) acc.frozenRows += 1;
    const contrib = contributionByPlayer.get(p.id);
    if (contrib) {
      acc.points += contrib.points;
      acc.submissions += contrib.submissions;
      for (const t of contrib.tiles) acc.tiles.add(t);
    }
    acc.deaths += p.deaths ?? 0;
    acc.lootGpGained += p.lootGpGained ?? 0;
    acc.pvpKills += p.pvpKills ?? 0;
    for (const d of daysByPlayer.get(p.id) ?? []) acc.days.add(d);
  }

  // Stat gains (XP / boss KC) per person.
  for (const st of statStandings) {
    for (const pl of st.players) {
      if (pl.gained <= 0) continue;
      const row = eventPlayers.find((p) => p.id === pl.playerId);
      if (!row || row.teamId == null) continue;
      const acc = byPerson.get(resolve(row.clanMemberId, row.name).key);
      if (!acc) continue;
      if (st.statType === 'skill') acc.xpGained += pl.gained;
      else acc.kcGained += pl.gained;
    }
  }

  // Finishing blows.
  for (const c of eventCompletions) {
    if (c.creditPlayerId == null) continue;
    const row = eventPlayers.find((p) => p.id === c.creditPlayerId);
    if (!row || row.teamId == null) continue;
    const acc = byPerson.get(resolve(row.clanMemberId, row.name).key);
    if (acc) acc.tilesFinished += 1;
  }

  return [...byPerson.values()].map((acc) => {
    const { days, frozenRows, tiles: tileSet, ...row } = acc;
    return {
      ...row,
      tilesContributed: tileSet.size,
      activeDays: days.size,
      lastActiveDay: days.size ? Math.max(...days) : null,
      subbedOut: frozenRows > 0 && frozenRows === acc.accounts,
    };
  });
}

/**
 * Materialize (or re-materialize) the facts for one event — idempotent delete+insert, so a re-run
 * after late edits (progress fixes, re-attribution) simply refreshes the rows. Refuses events that
 * haven't ended unless `force` (the backfill and admin tooling pass it for sanity re-runs).
 */
export async function writePlayerEventFacts(eventId: number, opts: { force?: boolean } = {}): Promise<number> {
  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event) return 0;
  if (!opts.force && !isEventEnded(event)) return 0;

  const rows = await computePlayerEventFacts(eventId);
  if (!rows) return 0;
  const computedAt = new Date().toISOString();

  await db.delete(playerEventFacts).where(eq(playerEventFacts.eventId, eventId));
  if (rows.length) {
    await db.insert(playerEventFacts).values(
      rows.map((r) => ({
        eventId: r.eventId,
        personKey: r.personKey,
        clanMemberId: r.clanMemberId,
        userId: r.userId,
        rsn: r.rsn,
        accounts: r.accounts,
        teamId: r.teamId,
        points: r.points,
        tilesContributed: r.tilesContributed,
        tilesFinished: r.tilesFinished,
        submissions: r.submissions,
        xpGained: r.xpGained,
        kcGained: r.kcGained,
        deaths: r.deaths,
        lootGpGained: r.lootGpGained,
        pvpKills: r.pvpKills,
        activeDays: r.activeDays,
        lastActiveDay: r.lastActiveDay,
        eventDays: r.eventDays,
        subbedOut: r.subbedOut ? 1 : 0,
        teamRank: r.teamRank,
        teamsTotal: r.teamsTotal,
        teamPoints: r.teamPoints,
        topTeamPoints: r.topTeamPoints,
        computedAt,
      })),
    );
  }
  return rows.length;
}
