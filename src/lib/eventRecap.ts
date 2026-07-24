import { db } from '@/db';
import { events, teams, tiles, players, completions, submissions } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { computeEventMvp, type StatGainMap } from '@/lib/memberBreakdown';
import { loadPlayerOwners } from '@/lib/draftProfiles';
import { getStatStandings } from '@/lib/statStandings';
import { parseContributionSnapshot, type StatContributionSnapshot } from '@/lib/statTracking';
import { isEventEnded } from '@/lib/survey';
import { isPointsMode } from '@/lib/utils';

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// Event "recap" — the fun end-of-event superlatives ("Warmonger", "Big Baller", "Speed Demon", …).
// Everything here is DERIVED from data the app already stores — append-only `submissions` +
// `completions` (frozen at event end) and the stat standings — so a recap needs no new tables and
// stops drifting once the event closes. Two more awards (Most Deaths / Loot Lord) arrive later once
// the plugin captures deaths + total loot value; they slot straight into this same catalogue.
//
// Attribution is per-PERSON, not per-account: on a 'per-person' event a player's several accounts are
// merged into one contender (mirrors the MVP rollup) so alts don't split — or stack — someone's total.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

// One contender's line in an award (winner or runner-up).
export interface RecapEntry {
  name: string;
  teamName: string | null;
  teamColor: string | null;
  value: number;
  valueLabel: string; // pre-formatted, e.g. "1,204 kills" / "51,200,000 gp" / "1:23"
  detail?: string; // optional context, e.g. the tile a haul/clear came from
}

// A single superlative. Omitted entirely from a recap when nobody qualifies.
export interface RecapAward {
  key: string;
  emoji: string;
  title: string;
  blurb: string;
  winner: RecapEntry;
  runnersUp: RecapEntry[];
}

export interface EventRecap {
  eventId: number;
  eventName: string;
  ended: boolean;
  awards: RecapAward[];
  totals: {
    contenders: number;
    tilesCompleted: number;
    submissions: number;
    gpLooted: number;
  };
}

// A person's own slice of the recap, for the plugin dashboard card.
export interface PlayerRecap {
  ended: boolean;
  awardsWon: { emoji: string; title: string; valueLabel: string }[];
  stats: { key: string; label: string; value: string }[];
}

// Running per-person tallies. `value` semantics differ per field; see the award builders below.
interface PersonStat {
  personKey: string;
  name: string;
  teamId: number | null;
  teamName: string | null;
  teamColor: string | null;
  accounts: number;
  kills: number;
  drops: number;
  pvpKills: number;
  deathlessClears: number;
  submissions: number;
  tilesFinished: number;
  bestHaul: number; // biggest single value-tile submission (gp)
  bestHaulTile: string | null;
  fastestClear: number | null; // min timed-tile durationSeconds
  fastestClearTile: string | null;
  xpGained: number;
  kcGained: number;
}

function emptyStat(personKey: string): PersonStat {
  return {
    personKey,
    name: '',
    teamId: null,
    teamName: null,
    teamColor: null,
    accounts: 0,
    kills: 0,
    drops: 0,
    pvpKills: 0,
    deathlessClears: 0,
    submissions: 0,
    tilesFinished: 0,
    bestHaul: 0,
    bestHaulTile: null,
    fastestClear: null,
    fastestClearTile: null,
    xpGained: 0,
    kcGained: 0,
  };
}

// mm:ss for anything under an hour, else h:mm:ss — how OSRS raid timers read.
function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

// Internal builder shared by getEventRecap + getPlayerRecap: loads everything once and returns the
// per-person tallies (keyed by personKey) plus the finished catalogue of awards.
async function computeRecap(eventId: number): Promise<{
  event: { id: number; name: string; forceEndedAt: string | null; endDate: string | null };
  awards: RecapAward[];
  totals: EventRecap['totals'];
  byPerson: Map<string, PersonStat>;
  personKeyByPlayerId: Map<number, string>;
} | null> {
  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event) return null;

  const [eventTeams, eventTiles, eventPlayers] = await Promise.all([
    db.select().from(teams).where(eq(teams.eventId, eventId)),
    db.select().from(tiles).where(eq(tiles.eventId, eventId)),
    db.select().from(players).where(eq(players.eventId, eventId)),
  ]);

  const tileIds = eventTiles.map((t) => t.id);
  const tileById = new Map(eventTiles.map((t) => [t.id, t]));
  const teamById = new Map(eventTeams.map((t) => [t.id, t]));

  // Frozen completions for this event's tiles (parse the KC/XP split once for the MVP calc).
  const eventCompletions = tileIds.length
    ? (await db.select().from(completions).where(inArray(completions.tileId, tileIds))).map((c) => ({
        id: c.id,
        teamId: c.teamId,
        tileId: c.tileId,
        completedAt: c.completedAt,
        creditPlayerId: c.creditPlayerId,
        statContributions: parseContributionSnapshot(c.statContributions) as StatContributionSnapshot | null,
      }))
    : [];

  // Just the submission columns the recap needs (never the proof/media rows — this can run on the
  // public event page, and a kill-count event has a LOT of submissions).
  const eventSubmissions = tileIds.length
    ? await db
        .select({
          tileId: submissions.tileId,
          teamId: submissions.teamId,
          creditPlayerId: submissions.creditPlayerId,
          amount: submissions.amount,
          durationSeconds: submissions.durationSeconds,
        })
        .from(submissions)
        .where(inArray(submissions.tileId, tileIds))
    : [];

  // Per-person key: on a 'per-person' event, merge a player's accounts by their owner; otherwise
  // (and for guests) each account stands alone.
  const ownerByPlayerId = await loadPlayerOwners(eventPlayers);
  const perPerson = event.accountSlotMode === 'per-person';
  const personKeyByPlayerId = new Map<number, string>();
  for (const p of eventPlayers) {
    const owner = perPerson ? ownerByPlayerId.get(p.id) : null;
    personKeyByPlayerId.set(p.id, owner != null ? `u${owner}` : `p${p.id}`);
  }

  const byPerson = new Map<string, PersonStat>();
  const stat = (playerId: number | null | undefined): PersonStat | null => {
    if (playerId == null) return null;
    const key = personKeyByPlayerId.get(playerId);
    if (!key) return null;
    let s = byPerson.get(key);
    if (!s) {
      s = emptyStat(key);
      byPerson.set(key, s);
    }
    return s;
  };

  // Seed identity (name / team) from the roster so a contender reads right even before we merge in
  // their work. Lead account = whichever the roster lists first; extra accounts show as "+N".
  const seededAccounts = new Set<number>();
  for (const p of eventPlayers) {
    const s = stat(p.id);
    if (!s) continue;
    if (!seededAccounts.has(p.id)) {
      s.accounts += 1;
      seededAccounts.add(p.id);
    }
    if (!s.name) {
      s.name = p.name;
      s.teamId = p.teamId;
      const team = p.teamId != null ? teamById.get(p.teamId) : null;
      s.teamName = team?.name ?? null;
      s.teamColor = team?.color ?? null;
    }
  }

  // Fold submissions into per-person tallies.
  let totalGpLooted = 0;
  for (const sub of eventSubmissions) {
    const s = stat(sub.creditPlayerId);
    if (!s) continue;
    const tile = tileById.get(sub.tileId);
    const type = tile?.tileType ?? null;
    s.submissions += 1;
    const amt = Math.max(0, sub.amount);
    if (type === 'kill') s.kills += amt;
    else if (type === 'pvp') s.pvpKills += amt;
    else if (type === 'drop') s.drops += amt;
    else if (type === 'deathless') s.deathlessClears += amt;
    else if (type === 'value' || type === 'valuetotal') {
      totalGpLooted += amt;
      if (amt > s.bestHaul) {
        s.bestHaul = amt;
        s.bestHaulTile = tile?.label ?? null;
      }
    }
    if (sub.durationSeconds != null && sub.durationSeconds > 0) {
      if (s.fastestClear == null || sub.durationSeconds < s.fastestClear) {
        s.fastestClear = sub.durationSeconds;
        s.fastestClearTile = tile?.label ?? null;
      }
    }
  }

  // Completion credit → "Closer".
  for (const c of eventCompletions) {
    const s = stat(c.creditPlayerId);
    if (s) s.tilesFinished += 1;
  }

  // Stat-tile XP / KC gained (frozen split ∪ live overlay, already reconciled by getStatStandings).
  const statStandings = await getStatStandings(eventId);
  const statGains: StatGainMap = {};
  for (const st of statStandings) {
    statGains[st.tileId] = st.players.map((pl) => ({ playerId: pl.playerId, gained: pl.gained }));
    for (const pl of st.players) {
      if (pl.gained <= 0) continue;
      const s = stat(pl.playerId);
      if (!s) continue;
      if (st.statType === 'skill') s.xpGained += pl.gained;
      else s.kcGained += pl.gained;
    }
  }

  // Finalize display names (append "+N" for merged multi-account people).
  for (const s of byPerson.values()) {
    if (s.accounts > 1) s.name = `${s.name} +${s.accounts - 1}`;
  }

  // ── Award builders ──────────────────────────────────────────────────────────────────────────
  const contenders = [...byPerson.values()];
  const toEntry = (s: PersonStat, value: number, valueLabel: string, detail?: string): RecapEntry => ({
    name: s.name || 'Unknown',
    teamName: s.teamName,
    teamColor: s.teamColor,
    value,
    valueLabel,
    detail,
  });

  // Rank contenders by a numeric extractor (desc, or asc for "smaller is better" like fastest time),
  // keep only positive/qualifying ones, and package top-3 into an award. Returns null if nobody has it.
  function award(
    key: string,
    emoji: string,
    title: string,
    blurb: string,
    entryFor: (s: PersonStat) => RecapEntry | null,
    opts: { asc?: boolean } = {},
  ): RecapAward | null {
    const ranked = contenders
      .map((s) => entryFor(s))
      .filter((e): e is RecapEntry => e != null)
      .sort((a, b) => (opts.asc ? a.value - b.value : b.value - a.value));
    if (ranked.length === 0) return null;
    return { key, emoji, title, blurb, winner: ranked[0], runnersUp: ranked.slice(1, 3) };
  }

  const awards: RecapAward[] = [];

  // MVP — reuse the exact points/tasks split the scoreboard already trusts (handles per-person too).
  const mvp = computeEventMvp({
    scoringMode: event.scoringMode,
    teams: eventTeams,
    players: eventPlayers,
    tiles: eventTiles,
    completions: eventCompletions,
    submissions: eventSubmissions,
    statGains,
    ownerByPlayerId,
    accountSlotMode: event.accountSlotMode,
  });
  if (mvp) {
    const pts = isPointsMode(event.scoringMode);
    awards.push({
      key: 'mvp',
      emoji: '🏆',
      title: 'MVP',
      blurb: 'Top contributor of the whole event',
      winner: {
        name: mvp.name,
        teamName: mvp.teamName,
        teamColor: mvp.teamColor,
        value: pts ? mvp.points : mvp.tasks,
        valueLabel: pts
          ? `${mvp.points.toLocaleString()} pts`
          : `${mvp.tasks} ${mvp.tasks === 1 ? 'tile' : 'tiles'}`,
      },
      runnersUp: [],
    });
  }

  const pushAward = (a: RecapAward | null) => {
    if (a) awards.push(a);
  };

  pushAward(
    award('big-baller', '💎', 'Big Baller', 'Biggest single loot drop', (s) =>
      s.bestHaul > 0 ? toEntry(s, s.bestHaul, `${s.bestHaul.toLocaleString()} gp`, s.bestHaulTile ?? undefined) : null,
    ),
  );
  pushAward(
    award('warmonger', '⚔️', 'Warmonger', 'Most kills credited', (s) =>
      s.kills > 0 ? toEntry(s, s.kills, `${s.kills.toLocaleString()} kills`) : null,
    ),
  );
  pushAward(
    award('loot-goblin', '🎣', 'Loot Goblin', 'Most drops credited', (s) =>
      s.drops > 0 ? toEntry(s, s.drops, `${s.drops.toLocaleString()} drops`) : null,
    ),
  );
  pushAward(
    award(
      'speed-demon',
      '⏱️',
      'Speed Demon',
      'Fastest timed clear',
      (s) =>
        s.fastestClear != null
          ? toEntry(s, s.fastestClear, formatDuration(s.fastestClear), s.fastestClearTile ?? undefined)
          : null,
      { asc: true },
    ),
  );
  pushAward(
    award('grinder', '📈', 'The Grinder', 'Most XP gained', (s) =>
      s.xpGained > 0 ? toEntry(s, s.xpGained, `${s.xpGained.toLocaleString()} XP`) : null,
    ),
  );
  pushAward(
    award('boss-slayer', '🐉', 'Boss Slayer', 'Most boss KC gained', (s) =>
      s.kcGained > 0 ? toEntry(s, s.kcGained, `${s.kcGained.toLocaleString()} KC`) : null,
    ),
  );
  pushAward(
    award('pker', '🗡️', 'PKer', 'Most PvP kills', (s) =>
      s.pvpKills > 0 ? toEntry(s, s.pvpKills, `${s.pvpKills.toLocaleString()} PvP kills`) : null,
    ),
  );
  pushAward(
    award('untouchable', '🛡️', 'Untouchable', 'Most deathless clears', (s) =>
      s.deathlessClears > 0
        ? toEntry(s, s.deathlessClears, `${s.deathlessClears.toLocaleString()} clears`)
        : null,
    ),
  );
  pushAward(
    award('closer', '🔥', 'The Closer', 'Landed the most finishing blows', (s) =>
      s.tilesFinished > 0
        ? toEntry(s, s.tilesFinished, `${s.tilesFinished} ${s.tilesFinished === 1 ? 'tile' : 'tiles'} finished`)
        : null,
    ),
  );
  pushAward(
    award('busy-bee', '🐝', 'Busy Bee', 'Most submissions of all', (s) =>
      s.submissions > 0 ? toEntry(s, s.submissions, `${s.submissions.toLocaleString()} submissions`) : null,
    ),
  );

  const totals: EventRecap['totals'] = {
    contenders: contenders.filter((s) => s.submissions > 0 || s.tilesFinished > 0 || s.xpGained > 0 || s.kcGained > 0).length,
    tilesCompleted: eventCompletions.length,
    submissions: eventSubmissions.length,
    gpLooted: totalGpLooted,
  };

  return {
    event: { id: event.id, name: event.name, forceEndedAt: event.forceEndedAt, endDate: event.endDate },
    awards,
    totals,
    byPerson,
    personKeyByPlayerId,
  };
}

// Full event recap — the superlatives board. Awards with no qualifying data are omitted.
export async function getEventRecap(eventId: number): Promise<EventRecap | null> {
  const r = await computeRecap(eventId);
  if (!r) return null;
  return {
    eventId: r.event.id,
    eventName: r.event.name,
    ended: isEventEnded(r.event),
    awards: r.awards,
    totals: r.totals,
  };
}

// One player's personal slice — their headline numbers plus any awards they took home. Powers the
// "your event, by the numbers" card on the plugin dashboard.
export async function getPlayerRecap(eventId: number, playerId: number): Promise<PlayerRecap | null> {
  const r = await computeRecap(eventId);
  if (!r) return null;
  const key = r.personKeyByPlayerId.get(playerId);
  const s = key ? r.byPerson.get(key) : null;

  const awardsWon = key
    ? r.awards
        .filter((a) => a.winner && sameContender(a.winner, s))
        .map((a) => ({ emoji: a.emoji, title: a.title, valueLabel: a.winner.valueLabel }))
    : [];

  const stats: PlayerRecap['stats'] = [];
  if (s) {
    if (s.tilesFinished > 0) stats.push({ key: 'finished', label: 'Tiles finished', value: s.tilesFinished.toLocaleString() });
    if (s.kills > 0) stats.push({ key: 'kills', label: 'Kills credited', value: s.kills.toLocaleString() });
    if (s.drops > 0) stats.push({ key: 'drops', label: 'Drops credited', value: s.drops.toLocaleString() });
    if (s.bestHaul > 0) stats.push({ key: 'haul', label: 'Biggest drop', value: `${s.bestHaul.toLocaleString()} gp` });
    if (s.xpGained > 0) stats.push({ key: 'xp', label: 'XP gained', value: s.xpGained.toLocaleString() });
    if (s.kcGained > 0) stats.push({ key: 'kc', label: 'Boss KC gained', value: s.kcGained.toLocaleString() });
    if (s.pvpKills > 0) stats.push({ key: 'pvp', label: 'PvP kills', value: s.pvpKills.toLocaleString() });
    if (s.submissions > 0) stats.push({ key: 'subs', label: 'Submissions', value: s.submissions.toLocaleString() });
  }

  return { ended: isEventEnded(r.event), awardsWon, stats };
}

// The MVP entry carries no personKey, so match a person to an award winner by their (unique within
// an event) display name + team. Good enough to light up "you won this" on the personal card.
function sameContender(entry: RecapEntry, s: PersonStat | null | undefined): boolean {
  if (!s) return false;
  return entry.name === s.name && entry.teamName === s.teamName;
}
