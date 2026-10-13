import { db } from '@/db';
import { clans, completions, eventDaySnapshots, eventParticipants, events, moments, teams, tiles } from '@/db/schema';
import { and, desc, eq, inArray, lt } from 'drizzle-orm';
import { scoreTeams } from '@/lib/boardScoring';
import { parseEventRules } from '@/lib/eventRules';
import { getEventRecap, getWindowRecap, type RecapAward } from '@/lib/eventRecap';
import { notifyEventStatsPost } from '@/lib/discord';
import { field, type DiscordEmbedField } from '@/lib/discordEmbeds';
import { formatGp } from '@/lib/adminEventsFormat';
import { log } from '@/lib/logger';
import {
  DAY_MS,
  biggestComeback,
  dueDigestDay,
  rankTeams,
  stampMs,
  trimStats,
  type DaySnapshotData,
  type PlayerDayCounters,
} from '@/lib/eventDay';

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// Mid-event stats posts: a DAILY DIGEST every 24h from the start, and a one-off HALFWAY REPORT.
//
// Both reuse the recap's award catalogue (lib/eventRecap) rather than growing a second one: the
// halfway report is the full recap "so far", and the digest is the recap over one 24h window, with
// the running counters (plugin deaths/loot/playtime, hiscores XP/KC) diffed against the snapshot the
// previous digest stored. That snapshot row is also the digest's idempotency latch.
//
// Deliberately nothing priced off drop rates (no "spoon" / "dry streak"): the wiki 1-in-N is shaky
// for raids and slayer-shared drops, and a wrong luck award is worse than none.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

/** Awards worth a line in the DAILY post, most-fun-first. MVP is shown separately. */
const DAILY_AWARD_ORDER = [
  'big-baller',
  'lottery-winner',
  'grinder',
  'boss-slayer',
  'tunnel-vision',
  'loot-lord',
  'wipe-magnet',
  'speed-demon',
  'no-life',
  'night-owl',
  'heavy-hitter',
  'closer',
  'pker',
  'jack-of-all-trades',
];
const DAILY_AWARD_COUNT = 6;

/** Awards for the HALFWAY report — the race so far. */
const HALFWAY_AWARD_ORDER = [
  'mvp',
  'first-blood',
  'big-baller',
  'lottery-winner',
  'warmonger',
  'boss-slayer',
  'grinder',
  'wipe-magnet',
  'loot-lord',
  'no-life',
  'tunnel-vision',
  'night-owl',
  'jack-of-all-trades',
];
const HALFWAY_AWARD_COUNT = 8;

/** Shortest event that gets a halfway report — a one-day event's "halfway" is lunchtime. */
const HALFWAY_MIN_MS = 2 * DAY_MS;

function awardLine(a: RecapAward): string {
  const detail = a.winner.detail ? ` · ${a.winner.detail}` : '';
  return `${a.emoji} **${a.title}** — ${a.winner.name} _(${a.winner.valueLabel}${detail})_`;
}

function pickAwards(awards: RecapAward[], order: string[], count: number): RecapAward[] {
  const byKey = new Map(awards.map((a) => [a.key, a]));
  return order.map((k) => byKey.get(k)).filter((a): a is RecapAward => !!a).slice(0, count);
}

function medal(rank: number): string {
  return rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;
}

function hours(minutes: number): string {
  const h = minutes / 60;
  return h >= 10 ? `${Math.round(h)}h` : `${h.toFixed(1)}h`;
}

function counters(p: typeof eventParticipants.$inferSelect): PlayerDayCounters {
  return {
    deaths: p.deaths ?? 0,
    lootGp: p.lootGpGained ?? 0,
    pvpKills: p.pvpKills ?? 0,
    minutes: p.minutesPlayed ?? 0,
    caTasks: p.caTasks ?? 0,
    biggestHit: p.biggestHit ?? 0,
    stats: trimStats(p.cachedStats ?? p.frozenStats),
  };
}

/**
 * Teams, roster and standings. `asOfMs` scores only completions landed before that moment, so a
 * digest for "day 3" ranks the board as it stood at the day-3 boundary even when the tick runs late.
 */
async function loadBoard(event: typeof events.$inferSelect, asOfMs?: number) {
  const [eventTeams, eventTiles, eventPlayers] = await Promise.all([
    db.select().from(teams).where(eq(teams.eventId, event.id)),
    db.select().from(tiles).where(eq(tiles.eventId, event.id)),
    db.select().from(eventParticipants).where(eq(eventParticipants.eventId, event.id)),
  ]);
  const tileIds = eventTiles.map((t) => t.id);
  const allCompletions = tileIds.length
    ? await db.select().from(completions).where(inArray(completions.tileId, tileIds))
    : [];
  const eventCompletions =
    asOfMs == null ? allCompletions : allCompletions.filter((c) => (stampMs(c.completedAt) ?? 0) < asOfMs);
  const scored = scoreTeams({
    scoringMode: event.scoringMode,
    rules: parseEventRules(event.rules),
    tiles: eventTiles,
    completions: eventCompletions,
    teams: eventTeams,
  });
  const ranks = rankTeams(scored.map((s) => ({ teamId: s.teamId, score: s.score })));
  const unit = scored[0]?.unit ?? (event.scoringMode === 'points' ? 'pts' : 'tiles');
  return { eventTeams, eventPlayers, scored, ranks, unit };
}

/** Clans that are a SIDE on this board: only per-clan boards, where each team carries its clan. */
async function clanSides(eventTeams: (typeof teams.$inferSelect)[]): Promise<Map<number, string>> {
  const clanIds = [...new Set(eventTeams.map((t) => t.clanId).filter((id): id is number => id != null))];
  if (clanIds.length < 2) return new Map();
  // clan-scope: global -- names of the clans already on this event's teams, read for a post to those same clans.
  const rows = await db.select({ id: clans.id, name: clans.name }).from(clans).where(inArray(clans.id, clanIds));
  return new Map(rows.map((r) => [r.id, r.name]));
}

interface MomentTally {
  pets: number;
  uniques: number;
  deaths: number;
  nemesis: { name: string; count: number } | null;
}

async function momentTally(eventId: number, fromMs: number | null, toMs: number | null): Promise<MomentTally> {
  const rows = await db
    .select({ kind: moments.kind, source: moments.source, occurredAt: moments.occurredAt })
    .from(moments)
    .where(eq(moments.eventId, eventId));
  const tally: MomentTally = { pets: 0, uniques: 0, deaths: 0, nemesis: null };
  const killers = new Map<string, number>();
  for (const r of rows) {
    const ms = stampMs(r.occurredAt);
    if (fromMs != null && (ms == null || ms < fromMs)) continue;
    if (toMs != null && (ms == null || ms >= toMs)) continue;
    if (r.kind === 'pet') tally.pets += 1;
    else if (r.kind === 'unique') tally.uniques += 1;
    else if (r.kind === 'death') {
      tally.deaths += 1;
      if (r.source) killers.set(r.source, (killers.get(r.source) ?? 0) + 1);
    }
  }
  for (const [name, count] of killers) {
    if (count >= 2 && (!tally.nemesis || count > tally.nemesis.count)) tally.nemesis = { name, count };
  }
  return tally;
}

function momentsLine(m: MomentTally): string | null {
  const parts: string[] = [];
  if (m.pets) parts.push(`🐾 ${m.pets} ${m.pets === 1 ? 'pet' : 'pets'}`);
  if (m.uniques) parts.push(`✨ ${m.uniques} ${m.uniques === 1 ? 'unique' : 'uniques'}`);
  if (m.deaths) parts.push(`💀 ${m.deaths} ${m.deaths === 1 ? 'death' : 'deaths'}`);
  if (m.nemesis) parts.push(`⚰️ Nemesis: **${m.nemesis.name}** (${m.nemesis.count} kills)`);
  return parts.length ? parts.join(' · ') : null;
}

/** Post the digest for any running event whose next 24h mark has passed. Never throws. */
export async function runDailyDigests(nowMs = Date.now()): Promise<void> {
  // clan-scope: global -- the lifecycle cron walks every clan's events; each post goes to that event's own clans.
  const running = await db
    .select()
    .from(events)
    .where(and(eq(events.startNotified, 1), eq(events.endNotified, 0)));
  for (const event of running) {
    if (event.forceEndedAt) continue;
    try {
      await digestEvent(event, nowMs);
    } catch (err) {
      log.warn('event-digest.failed', { eventId: event.id, err: String(err) });
    }
  }
}

async function digestEvent(event: typeof events.$inferSelect, nowMs: number): Promise<void> {
  const startMs = stampMs(event.startDate);
  const endMs = stampMs(event.endDate);
  if (startMs == null || endMs == null) return;
  const day = dueDigestDay(nowMs, startMs, endMs);
  if (day == null) return;

  const already = await db
    .select({ id: eventDaySnapshots.id })
    .from(eventDaySnapshots)
    .where(and(eq(eventDaySnapshots.eventId, event.id), eq(eventDaySnapshots.dayIndex, day)));
  if (already.length > 0) return;

  const [prevRow] = await db
    .select()
    .from(eventDaySnapshots)
    .where(and(eq(eventDaySnapshots.eventId, event.id), lt(eventDaySnapshots.dayIndex, day)))
    .orderBy(desc(eventDaySnapshots.dayIndex))
    .limit(1);
  let prev: DaySnapshotData | null = null;
  try {
    prev = prevRow ? (JSON.parse(prevRow.data) as DaySnapshotData) : null;
  } catch {
    prev = null;
  }

  // The window runs from the last digest's boundary (or the start) to this day's boundary — a box
  // that was down for a day posts one digest covering both, never two stale ones.
  const fromDay = prevRow?.dayIndex ?? 0;
  const fromMs = startMs + fromDay * DAY_MS;
  const toMs = startMs + day * DAY_MS;
  const { eventTeams, eventPlayers, scored, ranks, unit } = await loadBoard(event, toMs);
  const baseline = new Map<number, PlayerDayCounters>();
  for (const [id, c] of Object.entries(prev?.players ?? {})) baseline.set(Number(id), c);

  const windowRecap = await getWindowRecap(event.id, {
    fromIso: new Date(fromMs).toISOString(),
    toIso: new Date(toMs).toISOString(),
    baseline,
  });

  // Clan of the day — per-clan boards only, by score gained in the window.
  const sides = await clanSides(eventTeams);
  const clanDayWins: Record<string, number> = { ...(prev?.clanDayWins ?? {}) };
  const teamById = new Map(eventTeams.map((t) => [t.id, t]));
  const scoreGainByClan = new Map<number, number>();
  for (const s of scored) {
    const clanId = teamById.get(s.teamId)?.clanId;
    if (clanId == null || !sides.has(clanId)) continue;
    const before = prev?.teams?.[String(s.teamId)]?.score ?? 0;
    scoreGainByClan.set(clanId, (scoreGainByClan.get(clanId) ?? 0) + (s.score - before));
  }
  let clanOfDay: { clanId: number; gained: number } | null = null;
  if (scoreGainByClan.size >= 2) {
    const sorted = [...scoreGainByClan.entries()].sort((a, b) => b[1] - a[1]);
    if (sorted[0][1] > sorted[1][1]) {
      clanOfDay = { clanId: sorted[0][0], gained: sorted[0][1] };
      clanDayWins[String(clanOfDay.clanId)] = (clanDayWins[String(clanOfDay.clanId)] ?? 0) + 1;
    }
  }

  const data: DaySnapshotData = {
    players: Object.fromEntries(eventPlayers.map((p) => [String(p.id), counters(p)])),
    teams: Object.fromEntries(scored.map((s) => [String(s.teamId), { score: s.score, rank: ranks.get(s.teamId) ?? 0 }])),
    clanDayWins,
  };

  // CLAIM the day before posting: the unique (event, day) index makes a concurrent tick's insert a
  // no-op, so exactly one tick posts.
  const claimed = await db
    .insert(eventDaySnapshots)
    .values({ eventId: event.id, dayIndex: day, takenAt: new Date(nowMs).toISOString(), data: JSON.stringify(data) })
    .onConflictDoNothing()
    .returning({ id: eventDaySnapshots.id });
  if (claimed.length === 0) return;

  const fields: DiscordEmbedField[] = [];

  // Standings with movement since the last digest.
  const standings = [...scored]
    .sort((a, b) => b.score - a.score)
    .map((s) => {
      const team = teamById.get(s.teamId);
      const rank = ranks.get(s.teamId) ?? 0;
      const prevTeam = prev?.teams?.[String(s.teamId)];
      const gained = s.score - (prevTeam?.score ?? 0);
      const moved = prevTeam ? prevTeam.rank - rank : 0;
      const arrow = moved > 0 ? ` ▲${moved}` : moved < 0 ? ` ▼${-moved}` : '';
      const today = gained > 0 ? ` _(+${gained.toLocaleString()} today)_` : '';
      return `${medal(rank)} **${team?.name ?? 'Team'}** — ${s.score.toLocaleString()} ${unit}${arrow}${today}`;
    });
  if (standings.length) fields.push(field('📊 Standings', standings.join('\n'), false));

  if (windowRecap) {
    const mvp = windowRecap.awards.find((a) => a.key === 'mvp');
    if (mvp) {
      const team = mvp.winner.teamName ? ` (${mvp.winner.teamName})` : '';
      fields.push(field('🏆 MVP of the day', `**${mvp.winner.name}**${team} — ${mvp.winner.valueLabel}`, false));
    }
    const picks = pickAwards(windowRecap.awards, DAILY_AWARD_ORDER, DAILY_AWARD_COUNT);
    if (picks.length) fields.push(field('🏅 Today’s awards', picks.map(awardLine).join('\n'), false));

    // Clan v clan totals for the day.
    if (sides.size >= 2) {
      const clanOfPlayer = new Map<number, number>();
      for (const p of eventPlayers) {
        const clanId = p.teamId != null ? teamById.get(p.teamId)?.clanId : null;
        if (clanId != null && sides.has(clanId)) clanOfPlayer.set(p.id, clanId);
      }
      const totals = new Map<number, { xp: number; kc: number; deaths: number; loot: number; minutes: number; tiles: number }>();
      for (const person of windowRecap.people) {
        const clanId = person.playerIds.map((id) => clanOfPlayer.get(id)).find((c) => c != null);
        if (clanId == null) continue;
        const t = totals.get(clanId) ?? { xp: 0, kc: 0, deaths: 0, loot: 0, minutes: 0, tiles: 0 };
        t.xp += person.xpGained;
        t.kc += person.kcGained;
        t.deaths += person.deaths;
        t.loot += person.lootGp;
        t.minutes += person.minutesPlayed;
        t.tiles += person.tilesFinished;
        totals.set(clanId, t);
      }
      const lines = [...sides.entries()].map(([clanId, name]) => {
        const t = totals.get(clanId);
        const crown = clanOfDay?.clanId === clanId ? ' 👑' : '';
        if (!t) return `**${name}**${crown} — quiet day`;
        const bits = [
          `${t.xp.toLocaleString()} XP`,
          `${t.kc.toLocaleString()} KC`,
          t.loot > 0 ? `${formatGp(t.loot)} loot` : null,
          t.minutes > 0 ? `${hours(t.minutes)} played` : null,
          `${t.deaths} ${t.deaths === 1 ? 'death' : 'deaths'}`,
        ].filter(Boolean);
        return `**${name}**${crown} — ${bits.join(' · ')}`;
      });
      const tally = Object.keys(clanDayWins).length
        ? `\nDays won: ${[...sides.entries()].map(([id, name]) => `${name} ${clanDayWins[String(id)] ?? 0}`).join(' – ')}`
        : '';
      fields.push(field('⚔️ Clan v clan today', lines.join('\n') + tally, false));
    }
  }

  const m = await momentTally(event.id, fromMs, toMs);
  const mLine = momentsLine(m);
  if (mLine) fields.push(field('🎲 Moments', mLine, false));

  const span = day - fromDay > 1 ? `Days ${fromDay + 1}–${day}` : `Day ${day}`;
  await notifyEventStatsPost({
    clanId: event.clanId,
    eventId: event.id,
    eventName: event.name,
    title: `📅 ${span} recap`,
    description: clanOfDay
      ? `**${sides.get(clanOfDay.clanId)}** took the day (+${clanOfDay.gained.toLocaleString()} ${unit}).`
      : `Here’s how ${span.toLowerCase()} went.`,
    fields,
  });
  log.info('event-digest.posted', { eventId: event.id, day });
}

/** Post the one-off halfway report for any running event that just crossed its midpoint. Never throws. */
export async function runHalfwayReports(nowMs = Date.now()): Promise<void> {
  // clan-scope: global -- the lifecycle cron walks every clan's events; each post goes to that event's own clans.
  const running = await db
    .select()
    .from(events)
    .where(and(eq(events.startNotified, 1), eq(events.endNotified, 0), eq(events.halfwayNotified, false)));
  for (const event of running) {
    if (event.forceEndedAt) continue;
    const startMs = stampMs(event.startDate);
    const endMs = stampMs(event.endDate);
    if (startMs == null || endMs == null || endMs - startMs < HALFWAY_MIN_MS) continue;
    const midMs = startMs + (endMs - startMs) / 2;
    if (nowMs < midMs || nowMs >= endMs) continue;
    try {
      const flipped = await db
        .update(events)
        .set({ halfwayNotified: true })
        .where(and(eq(events.id, event.id), eq(events.halfwayNotified, false)))
        .returning({ id: events.id });
      if (flipped.length === 0) continue;

      const [{ eventTeams, scored, ranks, unit }, recap] = await Promise.all([loadBoard(event), getEventRecap(event.id)]);
      const teamById = new Map(eventTeams.map((t) => [t.id, t]));
      const fields: DiscordEmbedField[] = [];
      const standings = [...scored]
        .sort((a, b) => b.score - a.score)
        .map((s) => `${medal(ranks.get(s.teamId) ?? 0)} **${teamById.get(s.teamId)?.name ?? 'Team'}** — ${s.score.toLocaleString()} ${unit}`);
      if (standings.length) fields.push(field('📊 Standings at the half', standings.join('\n'), false));
      if (recap) {
        const picks = pickAwards(recap.awards, HALFWAY_AWARD_ORDER, HALFWAY_AWARD_COUNT);
        if (picks.length) fields.push(field('🏅 Awards so far', picks.map(awardLine).join('\n'), false));
        const t = recap.totals;
        const bits = [
          `${t.tilesCompleted.toLocaleString()} tiles done`,
          `${t.contenders.toLocaleString()} players on the board`,
          t.gpLooted > 0 ? `${formatGp(t.gpLooted)} in tracked hauls` : null,
        ].filter(Boolean);
        fields.push(field('🔢 By the numbers', bits.join(' · '), false));
      }
      const m = await momentTally(event.id, null, null);
      const mLine = momentsLine(m);
      if (mLine) fields.push(field('🎲 Moments so far', mLine, false));

      await notifyEventStatsPost({
        clanId: event.clanId,
        eventId: event.id,
        eventName: event.name,
        title: '⏳ Halfway report',
        description: 'Half the clock is gone. Here’s who’s making it count — every award is still up for grabs.',
        fields,
      });
      log.info('event-digest.halfway-posted', { eventId: event.id });
    } catch (err) {
      log.warn('event-digest.halfway-failed', { eventId: event.id, err: String(err) });
    }
  }
}

/**
 * Extra one-liners for the event-ended post: the biggest comeback (from the daily rank history),
 * the event's nemesis, and the clan-of-the-day tally. Best-effort; empty on any failure.
 */
export async function endOfEventFacts(event: typeof events.$inferSelect): Promise<string[]> {
  const facts: string[] = [];
  try {
    const snaps = await db
      .select()
      .from(eventDaySnapshots)
      .where(eq(eventDaySnapshots.eventId, event.id))
      .orderBy(eventDaySnapshots.dayIndex);
    const parsed = snaps
      .map((r) => {
        try {
          return JSON.parse(r.data) as DaySnapshotData;
        } catch {
          return null;
        }
      })
      .filter((d): d is DaySnapshotData => d != null);
    const { eventTeams, ranks } = await loadBoard(event);
    const teamById = new Map(eventTeams.map((t) => [t.id, t]));
    const history = parsed.map(
      (d) => new Map(Object.entries(d.teams ?? {}).map(([id, t]) => [Number(id), t.rank] as [number, number])),
    );
    if (eventTeams.length >= 3) {
      const comeback = biggestComeback(history, ranks, 2);
      if (comeback) {
        facts.push(`🔁 **Comeback:** ${teamById.get(comeback.teamId)?.name ?? 'A team'} climbed from ${medal(comeback.from)} to ${medal(comeback.to)}`);
      }
    }
    const last = parsed[parsed.length - 1];
    const sides = await clanSides(eventTeams);
    if (last?.clanDayWins && sides.size >= 2) {
      facts.push(`👑 **Days won:** ${[...sides.entries()].map(([id, name]) => `${name} ${last.clanDayWins?.[String(id)] ?? 0}`).join(' – ')}`);
    }
    const m = await momentTally(event.id, null, null);
    if (m.nemesis) facts.push(`⚰️ **Nemesis:** ${m.nemesis.name} — ${m.nemesis.count} kills on us`);
    if (m.pets) facts.push(`🐾 **Pets:** ${m.pets} this event`);
  } catch (err) {
    log.warn('event-digest.end-facts-failed', { eventId: event.id, err: String(err) });
  }
  return facts;
}
