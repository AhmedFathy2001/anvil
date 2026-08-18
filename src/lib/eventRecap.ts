import { db } from '@/db';
import { events, teams, tiles, eventParticipants, completions, submissions } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { computeEventMvp, type StatGainMap } from '@/lib/memberBreakdown';
import { loadPlayerOwners } from '@/lib/draftProfiles';
import { getStatStandings } from '@/lib/statStandings';
import { parseContributionSnapshot, type StatContributionSnapshot } from '@/lib/statTracking';
import { isEventEnded } from '@/lib/survey';
import { isPointsMode } from '@/lib/utils';
import { biggestGain, clueGain, isEarlyHour, isNightHour, localHour } from '@/lib/recapDerive';
import { statKeys } from '@/lib/tileKinds';
import { activityFor } from '@/lib/hiscoresActivities';
import { BOSSES } from '@/lib/constants';

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
  /** Plugin-pushed per-event "You have defeated" total — covers PKs with no pvp tile on the board. */
  pvpKillCounter: number;
  deathlessClears: number;
  submissions: number;
  tilesFinished: number;
  bestHaul: number; // biggest single value-tile submission (gp)
  bestHaulTile: string | null;
  fastestClear: number | null; // min timed-tile durationSeconds
  fastestClearTile: string | null;
  xpGained: number;
  kcGained: number;
  deaths: number; // plugin-pushed per-event death count
  lootGpTotal: number; // plugin-pushed total loot GP for the event
  /** Hardest single hitsplat landed this event (plugin-pushed). */
  biggestHit: number;
  /** Minutes actually logged in during the event (plugin-pushed) — the denominator for rates. */
  minutesPlayed: number;
  /** Tiles finished where this person was the ONLY contributor. */
  soloFinishes: number;
  /** Running sum of this person's share (0..1) of each tile they contributed to, and the count. */
  shareSum: number;
  shareCount: number;
  /** Timestamped actions bucketed by local hour — drives Night Owl / Early Bird. */
  nightActions: number;
  earlyActions: number;
  timedActions: number;
  /** Biggest single-boss KC grind this event, from the hiscores snapshots we already store. */
  topBossKc: number;
  topBossName: string | null;
  /** Caskets opened during the event, diffed out of the same snapshots (clue boards only). */
  cluesOpened: number;
  /** The tier they opened most of — the detail line under the Clue Hunter award. */
  topClueTier: string | null;
  /** Same, for a single skill's XP. */
  topSkillXp: number;
  topSkillName: string | null;
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
    pvpKillCounter: 0,
    deathlessClears: 0,
    submissions: 0,
    tilesFinished: 0,
    bestHaul: 0,
    bestHaulTile: null,
    fastestClear: null,
    fastestClearTile: null,
    xpGained: 0,
    kcGained: 0,
    deaths: 0,
    lootGpTotal: 0,
    biggestHit: 0,
    minutesPlayed: 0,
    soloFinishes: 0,
    shareSum: 0,
    shareCount: 0,
    nightActions: 0,
    earlyActions: 0,
    timedActions: 0,
    topBossKc: 0,
    topBossName: null,
    cluesOpened: 0,
    topClueTier: null,
    topSkillXp: 0,
    topSkillName: null,
  };
}

// Hiscores keys are camelCase ("theatreOfBlood"); show players the name they use. Lives here rather
// than in lib/recapDerive so that module can stay import-free for the test runner.
function bossLabel(key: string | null): string | undefined {
  if (!key) return undefined;
  return BOSSES.find((b) => b.key === key)?.label ?? key;
}

function skillLabel(key: string | null): string | undefined {
  if (!key) return undefined;
  return key.charAt(0).toUpperCase() + key.slice(1);
}

// An hour of play is the floor for a per-hour rate: below that, one good session reads as an
// absurd rate and the award stops meaning anything.
const MIN_MINUTES_FOR_RATE = 60;

// Play time as people say it: "14h 20m", or plain minutes under an hour.
function formatPlaytime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
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
    db.select().from(eventParticipants).where(eq(eventParticipants.eventId, eventId)),
  ]);

  // Does this board ask about clues at all? A "most caskets" award on a board with no clue tile is
  // a fact about who happened to be doing clues that fortnight, not about the event — so the award
  // only exists when at least one tile tracks a clue counter. Composite trackedStats ("cluesHard,
  // cluesElite") count, and so does any future clue-group key, since the test is the activity's
  // GROUP rather than a hardcoded list.
  const clueBoard = eventTiles.some((t) =>
    statKeys(t.trackedStat).some((key) => activityFor(key)?.group === 'clues'),
  );

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
          createdAt: submissions.createdAt,
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
      // Plugin-pushed per-event counters live on the player row — sum them across a person's accounts.
      s.deaths += p.deaths ?? 0;
      s.lootGpTotal += p.lootGpGained ?? 0;
      s.pvpKillCounter += p.pvpKills ?? 0;
      // Hardest hit is a record, so take the best across a person's accounts; play time is a
      // duration, so it sums (two accounts can't be played at once in any meaningful sense).
      s.biggestHit = Math.max(s.biggestHit, p.biggestHit ?? 0);
      s.minutesPlayed += p.minutesPlayed ?? 0;

      // Biggest single-boss and single-skill grind, diffed out of the hiscores snapshots already on
      // the row. Covers EVERY boss and skill, not just the ones a tile tracks — so the person who
      // spent the whole event at a boss nobody scored still gets their due. Keep the best across a
      // person's accounts rather than summing: "1,204 Zulrah" is the story, not a merged total.
      const boss = biggestGain(p.statsSnapshot, p.cachedStats ?? p.frozenStats, 'bosses');
      if (boss && boss.gained > s.topBossKc) {
        s.topBossKc = boss.gained;
        s.topBossName = boss.name;
      }
      const skill = biggestGain(p.statsSnapshot, p.cachedStats ?? p.frozenStats, 'skills');
      if (skill && skill.gained > s.topSkillXp) {
        s.topSkillXp = skill.gained;
        s.topSkillName = skill.name;
      }
      // Caskets are a tally, so alts SUM (unlike the single-boss record above): a person who
      // ran clues on two accounts opened both piles. Only read at all on a board that asked
      // for clues — see clueBoard below.
      if (clueBoard) {
        const clues = clueGain(p.statsSnapshot, p.cachedStats ?? p.frozenStats);
        if (clues) {
          s.cluesOpened += clues.total;
          if (!s.topClueTier || clues.topTierGained > 0) s.topClueTier = clues.topTier;
        }
      }
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
  //
  // "Submissions" counting: auto-detected tile types write ~one row per game action (a kill ping
  // every kill, a gain tick, …), while hiscores-KC tiles write no rows at all — so raw row counts
  // just measure who ground chat-line tiles (memberBreakdown already treats them as noise). For
  // Busy Bee / the personal card, an auto-ping type counts once per DISTINCT tile the person fed;
  // discrete turn-ins (drops, timed clears, diaries, CAs, value hauls) stay one each. The
  // event-wide totals.submissions stays the raw row count on purpose (fun activity number).
  const AUTO_PING_TYPES = new Set(['kill', 'lap', 'pvp', 'gain', 'deathless', 'lms']);
  const autoPingTilesSeen = new Set<string>(); // `${personKey}:${tileId}`
  let totalGpLooted = 0;
  for (const sub of eventSubmissions) {
    const s = stat(sub.creditPlayerId);
    if (!s) continue;
    const tile = tileById.get(sub.tileId);
    const type = tile?.tileType ?? null;
    if (type != null && AUTO_PING_TYPES.has(type)) {
      const seenKey = `${s.personKey}:${sub.tileId}`;
      if (!autoPingTilesSeen.has(seenKey)) {
        autoPingTilesSeen.add(seenKey);
        s.submissions += 1;
      }
    } else {
      s.submissions += 1;
    }
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

  // When did people actually play? Bucket every timestamped action in the actor's own timezone.
  const timezoneByPlayerId = new Map(eventPlayers.map((p) => [p.id, p.timezone]));
  const bucketAction = (playerId: number | null | undefined, iso: string | null | undefined) => {
    const s = stat(playerId);
    if (!s || !iso) return;
    const hour = localHour(iso, playerId != null ? timezoneByPlayerId.get(playerId) : null);
    if (hour == null) return;
    s.timedActions += 1;
    if (isNightHour(hour)) s.nightActions += 1;
    else if (isEarlyHour(hour)) s.earlyActions += 1;
  };
  for (const sub of eventSubmissions) bucketAction(sub.creditPlayerId, sub.createdAt);

  // Completion credit → "Closer", plus who finished tiles alone.
  //
  // Two kinds of tile need two sources for "alone". Stat tiles carry a frozen contribution split
  // (who gained what at the moment it completed); submission-backed tiles don't, so the split is
  // rebuilt from the submissions on that tile+team. Either way a person's share is their slice of
  // the work — share == 1 means nobody else touched it.
  const submissionSplit = new Map<string, Map<number, number>>(); // `tileId:teamId` → playerId → amount
  for (const sub of eventSubmissions) {
    if (sub.creditPlayerId == null) continue;
    const key = `${sub.tileId}:${sub.teamId}`;
    let split = submissionSplit.get(key);
    if (!split) {
      split = new Map();
      submissionSplit.set(key, split);
    }
    split.set(sub.creditPlayerId, (split.get(sub.creditPlayerId) ?? 0) + Math.max(0, sub.amount));
  }

  for (const c of eventCompletions) {
    const s = stat(c.creditPlayerId);
    if (s) s.tilesFinished += 1;
    bucketAction(c.creditPlayerId, c.completedAt);

    // Per-person shares of this tile. Merge by personKey first, so a multi-account person doesn't
    // read as two contributors carrying each other.
    const byKey = new Map<string, number>();
    const addShare = (playerId: number | null | undefined, amount: number) => {
      if (playerId == null || amount <= 0) return;
      const key = personKeyByPlayerId.get(playerId);
      if (!key) return;
      byKey.set(key, (byKey.get(key) ?? 0) + amount);
    };
    if (c.statContributions?.split?.length) {
      for (const part of c.statContributions.split) addShare(part.playerId, part.gained);
    } else {
      const split = submissionSplit.get(`${c.tileId}:${c.teamId}`);
      if (split) for (const [playerId, amount] of split) addShare(playerId, amount);
    }
    const total = [...byKey.values()].reduce((a, b) => a + b, 0);
    if (total <= 0) continue;
    for (const [key, amount] of byKey) {
      const person = byPerson.get(key);
      if (!person) continue;
      person.shareSum += amount / total;
      person.shareCount += 1;
      if (byKey.size === 1) person.soloFinishes += 1;
    }
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
  // Clue boards only (see clueBoard): the contenders all carry 0 otherwise, so the award would be
  // omitted anyway — the flag is what stops us diffing snapshots for it in the first place.
  if (clueBoard) {
    pushAward(
      award('clue-hunter', '🗺️', 'Clue Hunter', 'Most caskets opened', (s) =>
        s.cluesOpened > 0
          ? toEntry(
              s,
              s.cluesOpened,
              `${s.cluesOpened.toLocaleString()} ${s.cluesOpened === 1 ? 'casket' : 'caskets'}`,
              s.topClueTier ? `mostly ${s.topClueTier}` : undefined,
            )
          : null,
      ),
    );
  }
  pushAward(
    // Two sources for the same fact: pvp-tile submissions and the plugin's event-wide defeat
    // counter. Take the max, never the sum — on a board WITH pvp tiles both see the same kills.
    award('pker', '🗡️', 'PKer', 'Most PvP kills', (s) => {
      const pks = Math.max(s.pvpKills, s.pvpKillCounter);
      return pks > 0 ? toEntry(s, pks, `${pks.toLocaleString()} PvP kills`) : null;
    }),
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
  // Plugin-only awards — populated once the plugin ships the deaths + total-loot-value capture.
  pushAward(
    award('loot-lord', '💰', 'Loot Lord', 'Most loot value banked', (s) =>
      s.lootGpTotal > 0 ? toEntry(s, s.lootGpTotal, `${s.lootGpTotal.toLocaleString()} gp`) : null,
    ),
  );
  pushAward(
    award('wipe-magnet', '💀', 'Wipe Magnet', 'Died the most', (s) =>
      s.deaths > 0 ? toEntry(s, s.deaths, `${s.deaths.toLocaleString()} ${s.deaths === 1 ? 'death' : 'deaths'}`) : null,
    ),
  );

  pushAward(
    award('heavy-hitter', '🔨', 'Heavy Hitter', 'Hardest single hit landed', (s) =>
      s.biggestHit > 0 ? toEntry(s, s.biggestHit, `${s.biggestHit.toLocaleString()} damage`) : null,
    ),
  );
  pushAward(
    award('no-life', '🕰️', 'Absolutely Locked In', 'Most hours played', (s) =>
      s.minutesPlayed > 0 ? toEntry(s, s.minutesPlayed, formatPlaytime(s.minutesPlayed)) : null,
    ),
  );
  pushAward(
    // The counterweight to every "most X" award, which mostly measure who played longest. Needs a
    // real session behind it so someone who logged in for ten lucky minutes doesn't take it.
    award('efficient', '⚡', 'Most Efficient', 'Most done per hour played', (s) => {
      if (s.minutesPlayed < MIN_MINUTES_FOR_RATE) return null;
      const done = s.tilesFinished + s.submissions;
      if (done <= 0) return null;
      const perHour = done / (s.minutesPlayed / 60);
      return toEntry(s, perHour, `${perHour.toFixed(1)}/hour`, formatPlaytime(s.minutesPlayed));
    }),
  );

  // ── Derived from data already on the board — no plugin release needed ───────────────────────

  pushAward(
    award('solo-act', '🧍', 'Solo Act', 'Finished the most tiles single-handed', (s) =>
      s.soloFinishes > 0
        ? toEntry(s, s.soloFinishes, `${s.soloFinishes} ${s.soloFinishes === 1 ? 'tile' : 'tiles'} alone`)
        : null,
    ),
  );
  pushAward(
    // The gentle inverse of Solo Act: present on plenty of tiles, small slice of each. Needs a few
    // contributions before it means anything — one lucky assist shouldn't win it.
    award(
      'the-passenger',
      '🚗',
      'The Passenger',
      'Along for the ride on the most tiles',
      (s) => {
        if (s.shareCount < 3 || s.soloFinishes > 0) return null;
        const avg = s.shareSum / s.shareCount;
        if (avg >= 0.34) return null; // a real third of the work isn't a passenger
        return toEntry(s, avg, `${Math.round(avg * 100)}% average share`, `${s.shareCount} tiles`);
      },
      { asc: true },
    ),
  );
  pushAward(
    // Needs a real sample: a person with two submissions at 2am isn't nocturnal, they're unlucky.
    award('night-owl', '🦉', 'Night Owl', 'Most active after midnight', (s) => {
      if (s.timedActions < 5 || s.nightActions === 0) return null;
      const pct = Math.round((s.nightActions / s.timedActions) * 100);
      return toEntry(s, s.nightActions, `${s.nightActions} after midnight`, `${pct}% of their play`);
    }),
  );
  pushAward(
    award('early-bird', '🐓', 'Early Bird', 'Most dawn-patrol activity', (s) => {
      if (s.timedActions < 5 || s.earlyActions === 0) return null;
      const pct = Math.round((s.earlyActions / s.timedActions) * 100);
      return toEntry(s, s.earlyActions, `${s.earlyActions} before 9am`, `${pct}% of their play`);
    }),
  );
  pushAward(
    // Every boss on the hiscores counts, not just the ones a tile tracks — the person who sank the
    // event into one boss gets it whether or not the board rewarded that boss.
    award('tunnel-vision', '🎯', 'Tunnel Vision', 'Most kills at a single boss', (s) =>
      s.topBossKc > 0
        ? toEntry(s, s.topBossKc, `${s.topBossKc.toLocaleString()} KC`, bossLabel(s.topBossName))
        : null,
    ),
  );
  pushAward(
    award('one-track-mind', '📚', 'One-Track Mind', 'Most XP poured into a single skill', (s) =>
      s.topSkillXp > 0
        ? toEntry(s, s.topSkillXp, `${s.topSkillXp.toLocaleString()} XP`, skillLabel(s.topSkillName))
        : null,
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
    // Non-zero only on a clue board — the diff isn't read otherwise.
    if (s.cluesOpened > 0) stats.push({ key: 'clues', label: 'Caskets opened', value: s.cluesOpened.toLocaleString() });
    const pks = Math.max(s.pvpKills, s.pvpKillCounter);
    if (pks > 0) stats.push({ key: 'pvp', label: 'PvP kills', value: pks.toLocaleString() });
    if (s.lootGpTotal > 0) stats.push({ key: 'loot', label: 'Loot value', value: `${s.lootGpTotal.toLocaleString()} gp` });
    if (s.deaths > 0) stats.push({ key: 'deaths', label: 'Deaths', value: s.deaths.toLocaleString() });
    if (s.biggestHit > 0) stats.push({ key: 'hit', label: 'Biggest hit', value: s.biggestHit.toLocaleString() });
    if (s.minutesPlayed > 0) stats.push({ key: 'played', label: 'Time played', value: formatPlaytime(s.minutesPlayed) });
    if (s.topBossKc > 0) {
      stats.push({
        key: 'top-boss',
        label: bossLabel(s.topBossName) ?? 'Top boss',
        value: `${s.topBossKc.toLocaleString()} KC`,
      });
    }
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
