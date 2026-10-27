// Runs the hiscores footprint checks (lib/footprint) over running boards and ones that just ended.
//
// Costs no hiscores budget: it reads what the sweep already fetched — each account's last poll
// (account_stat_snapshots) against the event baseline — and only trusts a poll taken after the
// plugin went quiet, which the sweep makes once a session ends (lib/pollLadder). Flags, never blocks.

import { and, eq, gt, inArray, isNotNull, isNull, lt, ne, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  accounts, accountSightings, accountStatSnapshots, eventDaySnapshots, eventParticipants, events, integrityNetwork,
  integritySignals, memberPersonalBests, submissions, tiles,
} from '@/db/schema';
import { parseEventRules } from '@/lib/eventRules';
import type { HiscoresSnapshot } from '@/lib/hiscores';
import { parseStamp } from '@/lib/dbTime';
import { log } from '@/lib/logger';
import { parseJsonArray } from '@/lib/tileKinds';
import {
  FOOTPRINT_SHORT_FLAG, SETTLE_MS, caTaskKeys, checkGain, checkKcLine, checkLaps, checkMobKills, checkMoved,
  countKeyFor, firstServiceKills, gainXpFloor, kcLineClaims, kcOf, killHpFloor, lapXpFloor, longHours, maxGain,
  newClogItems, pbJumps, pbKey, scheduleShift, twoCountries, type Verdict,
} from '@/lib/footprint';

const CHECK_EVERY_MS = 30 * 60_000;
/** Final logouts land on the hiscores after the end; keep checking for a while. */
const AFTER_END_MS = 3 * 86_400_000;
/** Network sightings are kept this long past a board's end, then deleted. */
const NETWORK_KEEP_MS = 30 * 86_400_000;
/** How far back a player's earlier activity is read for the schedule and timezone comparisons. */
const HISTORY_MS = 180 * 86_400_000;
const lastRun = new Map<number, number>();

/** Check every board that is due. Never throws. */
export async function runFootprintChecks(nowMs = Date.now()): Promise<void> {
  // clan-scope: global -- the lifecycle cron walks every clan's events; each check stays inside its event.
  const live = await db
    .select({ id: events.id, startDate: events.startDate, endDate: events.endDate, rules: events.rules })
    .from(events)
    .where(and(
      eq(events.startNotified, 1),
      or(isNull(events.endDate), gt(events.endDate, new Date(nowMs - AFTER_END_MS).toISOString())),
    ));
  for (const ev of live) {
    if (nowMs - (lastRun.get(ev.id) ?? 0) < CHECK_EVERY_MS) continue;
    lastRun.set(ev.id, nowMs);
    try {
      await checkEvent(ev.id, parseStamp(ev.startDate), parseEventRules(ev.rules).sharingChecks, nowMs);
    } catch (err) {
      log.warn('footprint.failed', { eventId: ev.id, err: String(err) });
    }
  }
  // clan-scope: global -- retention for every clan's boards alike.
  await db
    .delete(integrityNetwork)
    .where(inArray(
      integrityNetwork.eventId,
      db.select({ id: events.id }).from(events).where(lt(events.endDate, new Date(nowMs - NETWORK_KEEP_MS).toISOString())),
    ))
    .catch((err) => log.warn('footprint.network-purge-failed', { err: String(err) }));
}

function snap(json: string | null | undefined): HiscoresSnapshot | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as HiscoresSnapshot;
  } catch {
    return null;
  }
}

const RANK: Record<Verdict, number> = { unchecked: 0, ok: 1, short: 2 };
const worse = (a: Verdict, b: Verdict): Verdict => (RANK[b] > RANK[a] ? b : a);

async function checkEvent(eventId: number, startMs: number | null, sharing: boolean, nowMs: number): Promise<void> {
  const players = await db
    .select({
      id: eventParticipants.id,
      accountId: eventParticipants.accountId,
      name: eventParticipants.name,
      teamId: eventParticipants.teamId,
      pbBaseline: eventParticipants.pbBaseline,
      baseline: eventParticipants.statsSnapshot,
      baselineAt: eventParticipants.snapshotAt,
      current: accountStatSnapshots.snapshot,
      polledAt: accounts.statsPolledAt,
      pushedAt: accounts.liveStatsAt,
    })
    .from(eventParticipants)
    .innerJoin(accounts, eq(accounts.id, eventParticipants.accountId))
    .leftJoin(accountStatSnapshots, eq(accountStatSnapshots.accountId, accounts.id))
    .where(and(eq(eventParticipants.eventId, eventId), isNotNull(eventParticipants.statsSnapshot)));
  if (players.length === 0) return;

  const boardTiles = await db
    .select({
      id: tiles.id, tileType: tiles.tileType, targetNpcs: tiles.targetNpcs, timedActivity: tiles.timedActivity,
      sourceNpcs: tiles.sourceNpcs, trackedItemIds: tiles.trackedItemIds,
    })
    .from(tiles)
    .where(eq(tiles.eventId, eventId));
  const tileById = new Map(boardTiles.map((t) => [t.id, t]));

  // Plugin-sent credits only: a staff/manual credit is a person's decision, not a claim to audit.
  const subs = boardTiles.length === 0 ? [] : await db
    .select({
      id: submissions.id, tileId: submissions.tileId, playerId: submissions.playerId,
      amount: submissions.amount, itemId: submissions.itemId, createdAt: submissions.createdAt,
      durationSeconds: submissions.durationSeconds, coopPartySize: submissions.coopPartySize,
      proofFacts: submissions.proofFacts, flaggedReason: submissions.flaggedReason, footprint: submissions.footprint,
    })
    .from(submissions)
    .where(and(inArray(submissions.tileId, boardTiles.map((t) => t.id)), eq(submissions.source, 'plugin')));

  const days = await db
    .select({ dayIndex: eventDaySnapshots.dayIndex, takenAt: eventDaySnapshots.takenAt, data: eventDaySnapshots.data })
    .from(eventDaySnapshots)
    .where(eq(eventDaySnapshots.eventId, eventId))
    .orderBy(eventDaySnapshots.dayIndex);

  for (const p of players) {
    const baseline = snap(p.baseline);
    const current = snap(p.current);
    if (!baseline) continue;
    await raiseSignals(eventId, p.id, baseline, current, startMs, days);

    const polledMs = parseStamp(p.polledAt);
    const baselineMs = parseStamp(p.baselineAt);
    const pushedMs = parseStamp(p.pushedAt);
    if (!current || polledMs == null || (pushedMs != null && polledMs < pushedMs + SETTLE_MS)) continue;

    const mine = subs
      // The client that CLAIMED it (playerId): the KC lives on that account even when the credit was
      // handed to a teammate (lib/creditIntegrity reads it the same way).
      .filter((s) => s.playerId === p.id && s.footprint !== 'dismissed')
      .filter((s) => (parseStamp(s.createdAt) ?? Infinity) <= polledMs - 60_000)
      .sort((a, b) => (parseStamp(a.createdAt) ?? 0) - (parseStamp(b.createdAt) ?? 0));
    const verdict = new Map<number, Verdict>(mine.map((s) => [s.id, 'unchecked']));
    const mark = (id: number, v: Verdict) => verdict.set(id, worse(verdict.get(id) ?? 'unchecked', v));

    // What each proof's game lines say, and whether its capture postdates the baseline. The "not
    // before the start" checks hold only then — a late joiner's baseline postdates their first kills.
    const facts = new Map(mine.map((s) => {
      const f = snap(s.proofFacts) as { lines?: { text: string }[]; capturedAt?: number } | null;
      const after = baselineMs != null && typeof f?.capturedAt === 'number' && f.capturedAt > baselineMs;
      return [s.id, { lines: Array.isArray(f?.lines) ? f!.lines! : [], after }];
    }));

    const clogSeen = new Set<string>();
    const clogProofs: { id: number; item: string }[] = [];
    for (const s of mine) {
      const { lines, after } = facts.get(s.id)!;
      // A KC (or clue tally) the proof printed must be one the hiscores reached, after the start.
      for (const c of kcLineClaims(lines)) mark(s.id, checkKcLine(c, after ? baseline : null, current));
      // A repeated combat task needs its monster killed during the event.
      if (after) {
        const ca = caTaskKeys(lines);
        if (ca.length > 0 && checkMoved(ca, baseline, current) === 'short') mark(s.id, 'short');
      }
      for (const item of after ? newClogItems(lines) : []) {
        if (clogSeen.has(item)) continue;
        clogSeen.add(item);
        clogProofs.push({ id: s.id, item });
      }
    }
    // Every new collection-log slot is +1 on Collections Logged.
    const slots = maxGain(baseline, current, 'collectionsLogged');
    if (slots != null) clogProofs.forEach((c, i) => mark(c.id, i < slots ? 'ok' : 'short'));

    for (const [tileId, rows] of groupBy(mine, (s) => s.tileId)) {
      const tile = tileById.get(tileId);
      if (!tile) continue;
      const targets = parseJsonArray<string>(tile.targetNpcs);
      const total = rows.reduce((n, s) => n + s.amount, 0);
      const newest = rows[rows.length - 1].id;
      // Plausibility checks are about the total, so one flag on the newest credit is the look it needs.
      // Passing one confirms nothing ("enough XP for this" is not "this happened"), so no ✓ from them.
      const judge = (v: Verdict) => {
        if (v === 'short') mark(newest, 'short');
      };
      if (tile.tileType === 'lap') {
        judge(checkLaps(total, lapXpFloor(targets), baseline, current));
        continue;
      }
      if (tile.tileType === 'gain') {
        judge(checkGain(gainXpFloor(rows, parseJsonArray<number>(tile.trackedItemIds)), baseline, current));
        continue;
      }
      if (tile.tileType === 'lms') {
        if (checkMoved(['lastManStanding'], baseline, current) === 'short') mark(newest, 'short');
        continue;
      }
      if (tile.tileType === 'drop') {
        // A drop restricted to hiscores bosses needs that boss killed at least once.
        const sources = parseJsonArray<string>(tile.sourceNpcs).map(countKeyFor);
        if (sources.length > 0 && sources.every(Boolean) && checkMoved(sources as string[], baseline, current) === 'short') {
          mark(newest, 'short');
        }
        continue;
      }
      const counted = tile.tileType === 'kill' ? targets
        : tile.tileType === 'timed' || tile.tileType === 'deathless' ? [tile.timedActivity ?? targets[0] ?? '']
        : null;
      if (!counted || counted.length === 0) continue;
      const keys = counted.map(countKeyFor);
      if (keys.some((k) => !k)) {
        // Mobs off the hiscores: their Hitpoints XP has to be somewhere.
        if (tile.tileType === 'kill') judge(checkMobKills(total, killHpFloor(targets), baseline, current));
        continue;
      }
      // Counted on the hiscores: credits in order; the ones inside the gain are confirmed. A shortfall
      // here is lib/creditIntegrity's to raise (with its noise margin, on the event Overview), not ours.
      const gains = [...new Set(keys as string[])].map((k) => maxGain(baseline, current, k));
      if (gains.some((g) => g == null)) continue;
      const gain = (gains as number[]).reduce((a, b) => a + b, 0);
      let used = 0;
      for (const s of rows) {
        used += tile.tileType === 'kill' ? s.amount : 1;
        if (used <= gain) mark(s.id, 'ok');
      }
    }

    for (const s of mine) {
      const v = verdict.get(s.id)!;
      if (v === 'unchecked' || v === s.footprint) continue;
      const flaggedReason = v === 'short'
        ? s.flaggedReason ?? FOOTPRINT_SHORT_FLAG
        : s.flaggedReason === FOOTPRINT_SHORT_FLAG ? null : s.flaggedReason; // a later read caught up
      await db.update(submissions).set({ footprint: v, flaggedReason }).where(eq(submissions.id, s.id));
    }
  }

  await raiseBehaviourSignals({ eventId, startMs, sharing, nowMs, players, subs, tileById });
}

function groupBy<T, K>(rows: T[], key: (r: T) => K): Map<K, T[]> {
  const m = new Map<K, T[]>();
  for (const r of rows) {
    const k = key(r);
    const list = m.get(k);
    if (list) list.push(r);
    else m.set(k, [r]);
  }
  return m;
}

async function raiseSignals(
  eventId: number,
  participantId: number,
  baseline: HiscoresSnapshot,
  current: HiscoresSnapshot | null,
  startMs: number | null,
  days: { dayIndex: number; takenAt: string; data: string }[],
): Promise<void> {
  const found: { kind: string; detail: object }[] = [];
  for (const key of firstServiceKills(baseline, current)) {
    found.push({ kind: `first_service_kill:${key}`, detail: { key, kc: kcOf(current, key) } });
  }
  // Day by day off the digest's rows, starting from the baseline at the start.
  let prev: HiscoresSnapshot | null = baseline.partial ? null : baseline;
  let prevMs = startMs;
  for (const d of days) {
    const stats = snap((snap(d.data) as { players?: Record<string, { stats?: string | null }> } | null)?.players?.[participantId]?.stats);
    const atMs = parseStamp(d.takenAt);
    if (stats && prev && prevMs != null && atMs != null) {
      const hours = longHours(prev, stats, (atMs - prevMs) / 3_600_000);
      if (hours != null) {
        found.push({ kind: `long_hours:day${d.dayIndex}`, detail: { hours: Math.round(hours * 10) / 10, windowHours: Math.round((atMs - prevMs) / 360_000) / 10 } });
      }
    }
    if (stats) {
      prev = stats;
      prevMs = atMs;
    }
  }
  if (found.length === 0) return;
  await db
    .insert(integritySignals)
    .values(found.map((f) => ({ eventId, participantId, kind: f.kind, detail: JSON.stringify(f.detail) })))
    .onConflictDoNothing();
}

type Signal = { participantId: number; kind: string; detail: object };

async function saveSignals(eventId: number, found: Signal[]): Promise<void> {
  if (found.length === 0) return;
  await db
    .insert(integritySignals)
    .values(found.map((f) => ({ eventId, participantId: f.participantId, kind: f.kind, detail: JSON.stringify(f.detail) })))
    .onConflictDoNothing();
}

/**
 * The signals that read how somebody plays rather than what the hiscores say: another Anvil login on
 * the account, a run far past their old PB, play at hours they never kept, a new timezone on their
 * proofs, and — on boards that opted in — shared networks and two countries.
 */
async function raiseBehaviourSignals(ctx: {
  eventId: number;
  startMs: number | null;
  sharing: boolean;
  nowMs: number;
  players: { id: number; accountId: number | null; name: string; teamId: number | null; pbBaseline: string | null }[];
  subs: { playerId: number | null; tileId: number; createdAt: string; proofFacts: string | null; durationSeconds: number | null; coopPartySize: number | null }[];
  tileById: Map<number, { tileType: string; timedActivity: string | null; targetNpcs: string | null }>;
}): Promise<void> {
  const { eventId, startMs, players, subs } = ctx;
  if (startMs == null) return;
  const found: Signal[] = [];
  const byAccount = new Map(players.filter((p) => p.accountId != null).map((p) => [p.accountId!, p]));
  const accountIds = [...byAccount.keys()];
  if (accountIds.length === 0) return;

  // Another Anvil login played this character during the event (lib/accountSightings records only
  // logins that aren't the owner's). The strongest of these: it is what a booster's own RuneLite looks like.
  const sightings = await db
    .select({ accountId: accountSightings.accountId, userId: accountSightings.userId, lastSeenAt: accountSightings.lastSeenAt })
    .from(accountSightings)
    .where(inArray(accountSightings.accountId, accountIds));
  for (const g of sightings) {
    const seen = parseStamp(g.lastSeenAt);
    const p = byAccount.get(g.accountId);
    if (p && seen != null && seen >= startMs) found.push({ participantId: p.id, kind: `other_login:${g.userId}`, detail: { seenAt: g.lastSeenAt } });
  }

  // Personal bests as they stood before the event, captured once (a PB beaten during it is gone after).
  for (const p of players) {
    if (p.pbBaseline != null || p.accountId == null) continue;
    const rows = await db
      .select({ activity: memberPersonalBests.activity, teamSize: memberPersonalBests.teamSize, centis: memberPersonalBests.centis, achievedAt: memberPersonalBests.achievedAt, updatedAt: memberPersonalBests.updatedAt })
      .from(memberPersonalBests)
      .where(eq(memberPersonalBests.accountId, p.accountId));
    const before: Record<string, number> = {};
    for (const r of rows) {
      const at = parseStamp(r.achievedAt ?? r.updatedAt);
      const key = countKeyFor(r.activity);
      if (!key || at == null || at >= startMs) continue;
      const k = pbKey(key, r.teamSize);
      before[k] = Math.min(before[k] ?? Infinity, r.centis);
    }
    p.pbBaseline = JSON.stringify(before);
    await db.update(eventParticipants).set({ pbBaseline: p.pbBaseline }).where(eq(eventParticipants.id, p.id));
  }
  for (const p of players) {
    let before: Record<string, number> = {};
    try {
      before = JSON.parse(p.pbBaseline ?? '{}');
    } catch {
      continue;
    }
    const runs = subs.flatMap((s) => {
      const tile = ctx.tileById.get(s.tileId);
      if (s.playerId !== p.id || tile?.tileType !== 'timed' || !s.durationSeconds) return [];
      const key = countKeyFor(tile.timedActivity ?? parseJsonArray<string>(tile.targetNpcs)[0] ?? '');
      return key ? [{ key, partySize: s.coopPartySize, seconds: s.durationSeconds }] : [];
    });
    for (const j of pbJumps(before, runs)) found.push({ participantId: p.id, kind: `pb_jump:${j.key}`, detail: j });
  }

  // Hours and timezones: this event's proofs against the same accounts' earlier ones.
  const history = await db
    .select({
      accountId: eventParticipants.accountId,
      createdAt: submissions.createdAt,
      tz: sql<string | null>`(${submissions.proofFacts}::json ->> 'tz')`,
    })
    .from(submissions)
    .innerJoin(eventParticipants, eq(eventParticipants.id, submissions.playerId))
    .where(and(
      inArray(eventParticipants.accountId, accountIds),
      ne(eventParticipants.eventId, eventId),
      gt(submissions.createdAt, new Date(startMs - HISTORY_MS).toISOString().replace('T', ' ').slice(0, 19)),
    ));
  const hourOf = (stamp: string) => {
    const ms = parseStamp(stamp);
    return ms == null ? null : new Date(ms).getUTCHours();
  };
  for (const p of players) {
    if (p.accountId == null) continue;
    const prior = history.filter((h) => h.accountId === p.accountId);
    const mine = subs.filter((s) => s.playerId === p.id);
    const off = scheduleShift(
      prior.map((h) => hourOf(h.createdAt)).filter((h): h is number => h != null),
      mine.map((s) => hourOf(s.createdAt)).filter((h): h is number => h != null),
    );
    if (off != null) found.push({ participantId: p.id, kind: 'schedule_shift', detail: { offShare: Math.round(off * 100), priorN: prior.length, eventN: mine.length } });

    // A proof's PC timezone changing — within the event, or away from the one every earlier proof had.
    const zones = new Set(mine.map((s) => (snapJson(s.proofFacts) as { tz?: string } | null)?.tz).filter((z): z is string => !!z));
    const priorZones = new Set(prior.map((h) => h.tz).filter((z): z is string => !!z));
    const usual = priorZones.size === 1 ? [...priorZones][0] : null;
    if (zones.size > 1 || (usual && zones.size === 1 && !zones.has(usual))) {
      found.push({ participantId: p.id, kind: 'timezone_change', detail: { zones: [...zones], usual } });
    }
  }

  // Opt-in boards: shared networks and two countries (lib/integrityNetwork).
  if (ctx.sharing) {
    const nets = await db
      .select({ participantId: integrityNetwork.participantId, netHash: integrityNetwork.netHash, country: integrityNetwork.country, firstSeenAt: integrityNetwork.firstSeenAt, lastSeenAt: integrityNetwork.lastSeenAt })
      .from(integrityNetwork)
      .where(eq(integrityNetwork.eventId, eventId));
    const byId = new Map(players.map((p) => [p.id, p]));
    const onNet = new Map<string, Set<number>>();
    for (const n of nets) onNet.set(n.netHash, (onNet.get(n.netHash) ?? new Set()).add(n.participantId));
    for (const ids of onNet.values()) {
      if (ids.size < 2) continue;
      for (const a of ids) {
        for (const b of ids) {
          if (a === b) continue;
          const other = byId.get(b);
          found.push({ participantId: a, kind: `shared_network:${b}`, detail: { other: other?.name ?? `#${b}`, sameTeam: other?.teamId != null && other.teamId === byId.get(a)?.teamId } });
        }
      }
    }
    for (const p of players) {
      const pair = twoCountries(nets.filter((n) => n.participantId === p.id).map((n) => ({
        country: n.country, first: parseStamp(n.firstSeenAt) ?? 0, last: parseStamp(n.lastSeenAt) ?? 0,
      })));
      if (pair) found.push({ participantId: p.id, kind: 'two_countries', detail: { countries: pair } });
    }
  }

  await saveSignals(eventId, found);
}

function snapJson(json: string | null | undefined): unknown {
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}
