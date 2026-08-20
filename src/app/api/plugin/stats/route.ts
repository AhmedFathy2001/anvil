import { NextResponse } from 'next/server';
import { requireClan } from '@/lib/clanContext';
import { db } from '@/db';
import { eventParticipants, tiles, teams, events, completions, clanRoster, weeklyParticipants } from '@/db/schema';
import { findRosterSeat, updateAccountOfSeat } from '@/lib/roster';
import { eq, and, inArray } from 'drizzle-orm';
import { resolvePluginMember } from '@/lib/auth';
import { statKeys } from '@/lib/tileKinds';
import { bossKeyForName, skillKeyForName, parsePluginStats } from '@/lib/pluginStats';
import { isActivityKey } from '@/lib/hiscoresActivities';
import { computeGainFromJson, isIndividualMode, buildContributionSnapshot } from '@/lib/statTracking';
import { liveStatsForMembers, parseStatKeyTimes } from '@/lib/liveStats';
import { getActiveWeeklyMetrics } from '@/lib/pluginConfig';
import { applyWeeklyValue } from '@/lib/weekly';
import { notifyTileCompletion } from '@/lib/discord';
import { evaluateCompletionGate } from '@/lib/completionGate';
import { handleBountyClaim } from '@/lib/revealEngine';

// Real-time boss-KC / skill-XP / activity ingest. The plugin posts {stats:[{name,kc}],
// skills:[{name,xp}], activities:[{key,value}]} with
// ABSOLUTE counts (no image), debounced to one push per key per 15 s. We resolve the caller's clan
// member from the account token (NO active bingo event required), store the max per key on
// clan_members.live_stats — the ONE member-scoped overlay read by both bingo tiles AND weekly
// SOTW/BOTW as max(hiscores, live) — then credit both immediately so a live kill/training burst
// lands before the 15-min hiscores sweep. The sweep is source of truth: it prunes a live entry once
// hiscores catches up. See lib/liveStats + lib/statTracking + the cron/stats sweep.

// Absolute sanity ceilings — reject obviously bogus pushes. No legit boss KC / skill XP approaches these.
const MAX_KC = 1_000_000;
const MAX_XP = 200_000_000;
// Activity counters (clue tiers, Soul Wars zeal, Colosseum glory, collection-log slots) are all
// small next to boss KC — the largest real value is a five-figure clue count — so MAX_KC is a
// generous ceiling that still rejects a garbage varbit read.
const MAX_ACTIVITY = MAX_KC;

// How long a per-key "rose just now" stamp is retained. Must outlast the stats sweep's stale-overlay
// window (~6h, the OSRS logout backstop) so that check can tell a still-active grind from a stuck push;
// "Active now" reads its own 5-min window and is unaffected by the longer retention. 7h > 6.5h sweep
// threshold so a legit entry's stamp is still present when the sweep decides whether to keep it.
const KEY_TIME_TTL_MS = 7 * 60 * 60_000;

export async function POST(request: Request) {
  const clan = await requireClan();
  // Member-level auth: unlike verifyPluginToken this does NOT require a live bingo event, so a member
  // who's only in a weekly comp can still push live stats.
  const member = await resolvePluginMember(request);
  if (!member) {
    return NextResponse.json({ error: 'Unauthorized. Provide Authorization: Bearer <accountToken> + X-RSN' }, { status: 401 });
  }

  let body: {
    stats?: Array<{ name?: string; kc?: number }>;
    skills?: Array<{ name?: string; xp?: number }>;
    activities?: Array<{ key?: string; value?: number }>;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const incoming = Array.isArray(body?.stats) ? body.stats : [];
  const incomingSkills = Array.isArray(body?.skills) ? body.skills : [];
  const incomingActivities = Array.isArray(body?.activities) ? body.activities : [];
  if (incoming.length === 0 && incomingSkills.length === 0 && incomingActivities.length === 0) {
    return NextResponse.json({ ok: true, updated: 0 });
  }

  // Map each pushed in-game name -> hiscores/skill key, keeping the max absolute value per key. Boss
  // KC and skill XP share the flat live_stats map (boss keys and skill names never collide).
  const pushed: Record<string, number> = {};
  for (const s of incoming) {
    if (!s || typeof s.name !== 'string' || typeof s.kc !== 'number') continue;
    if (!Number.isFinite(s.kc) || s.kc < 0 || s.kc > MAX_KC) continue;
    const key = bossKeyForName(s.name);
    if (!key) continue;
    pushed[key] = Math.max(pushed[key] ?? 0, Math.floor(s.kc));
  }
  for (const s of incomingSkills) {
    if (!s || typeof s.name !== 'string' || typeof s.xp !== 'number') continue;
    if (!Number.isFinite(s.xp) || s.xp < 0 || s.xp > MAX_XP) continue;
    const key = skillKeyForName(s.name);
    if (!key) continue;
    pushed[key] = Math.max(pushed[key] ?? 0, Math.floor(s.xp));
  }
  // Activities arrive already keyed — the plugin reads them from named varbits, so it knows exactly
  // which counter it holds and there's no in-game name to map. Unknown keys are dropped rather than
  // stored: live_stats is read by key, so a typo'd entry would sit there forever matching nothing.
  for (const a of incomingActivities) {
    if (!a || typeof a.key !== 'string' || typeof a.value !== 'number') continue;
    if (!Number.isFinite(a.value) || a.value < 0 || a.value > MAX_ACTIVITY) continue;
    if (!isActivityKey(a.key)) continue;
    const key = a.key.trim();
    pushed[key] = Math.max(pushed[key] ?? 0, Math.floor(a.value));
  }
  if (Object.keys(pushed).length === 0) {
    return NextResponse.json({ ok: true, updated: 0 });
  }

  const nowIso = new Date().toISOString();

  // Merge into the member's live overlay — absolute counts only ever rise, so keep the max per key.
  const memberRow = await findRosterSeat(eq(clanRoster.id, member.clanMemberId));
  const live = parsePluginStats(memberRow?.liveStats);
  const keyTimes = parseStatKeyTimes(memberRow?.liveStatKeyTimes);
  let changed = false;
  for (const [key, val] of Object.entries(pushed)) {
    if (val > (live[key] ?? 0)) {
      live[key] = val;
      // Stamp per-key recency ONLY on a real increase — this is the "grinding THIS stat right now"
      // signal "Active now" reads, so one fishing push no longer lights up every tile they've touched.
      keyTimes[key] = nowIso;
      changed = true;
    }
  }
  if (changed) {
    // Drop stale stamps so the map stays small and an old grind doesn't linger as "active".
    const nowMs = Date.parse(nowIso);
    for (const [k, iso] of Object.entries(keyTimes)) {
      const at = Date.parse(iso);
      if (!Number.isFinite(at) || nowMs - at > KEY_TIME_TTL_MS) delete keyTimes[k];
    }
    await updateAccountOfSeat(member.clanMemberId, {
        liveStats: JSON.stringify(live),
        liveStatsAt: nowIso,
        liveStatKeyTimes: JSON.stringify(keyTimes),
        // A push proves they're logged in and gaining right now, so clear any backoff the sweep had
        // built up while they were away: the next tick fetches them, and their hiscores reconcile
        // stays prompt. This is what lets idle members be deferred aggressively without an active
        // player ever going stale (lib/statHistory.ts).
      statsMissStreak: 0,
      statsNextDueAt: null,
    });
  }

  const updatedKeys = new Set(Object.keys(pushed));
  const completed: string[] = [];

  // ── Bingo credit: re-evaluate the member's active-event stat tiles so a real-time clear completes now.
  const playerRows = await db
    .select({
      id: eventParticipants.id,
      teamId: eventParticipants.teamId,
      eventId: eventParticipants.eventId,
      endDate: events.endDate,
      forceEndedAt: events.forceEndedAt,
    })
    .from(eventParticipants)
    .innerJoin(events, eq(eventParticipants.eventId, events.id))
    .where(eq(eventParticipants.clanMemberId, member.clanMemberId));
  const activePlayer = playerRows.find(
    (p) => p.teamId && !p.forceEndedAt && (!p.endDate || p.endDate > nowIso),
  );

  if (activePlayer) {
    const eventTiles = await db.select().from(tiles).where(eq(tiles.eventId, activePlayer.eventId));
    const statTiles = eventTiles.filter(
      (t) =>
        t.trackedStat &&
        (t.statType === 'boss' || t.statType === 'kc' || t.statType === 'skill') &&
        t.statGoal &&
        // Admin flipped this tile to manual — don't auto-credit from plugin-pushed stats.
        !t.autoTrackDisabled &&
        statKeys(t.trackedStat).some((k) => updatedKeys.has(k)),
    );

    if (statTiles.length > 0) {
      const teamPlayers = await db
        .select({
          id: eventParticipants.id,
          clanMemberId: eventParticipants.clanMemberId,
          statsSnapshot: eventParticipants.statsSnapshot,
          cachedStats: eventParticipants.cachedStats,
          frozenAt: eventParticipants.frozenAt,
          frozenStats: eventParticipants.frozenStats,
        })
        .from(eventParticipants)
        .where(and(eq(eventParticipants.eventId, activePlayer.eventId), eq(eventParticipants.teamId, activePlayer.teamId!)));
      // Every team player's live overlay (each is their own member; the pushing member's row reflects
      // the merge we just wrote). Gain = sum over keys of max(0, max(hiscores, live) − baseline).
      const teamLive = await liveStatsForMembers(teamPlayers.map((p) => p.clanMemberId));
      const gainFor = (p: (typeof teamPlayers)[number], keys: string[], statType: string): number => {
        // Benched players are pinned to frozenStats (no live overlay) so their locked gain still counts
        // toward the team total but never climbs.
        if (p.frozenAt) return computeGainFromJson(p.statsSnapshot, p.frozenStats, {}, keys, statType);
        const plug = (p.clanMemberId != null && teamLive.get(p.clanMemberId)) || {};
        return computeGainFromJson(p.statsSnapshot, p.cachedStats, plug, keys, statType);
      };

      const tileIds = eventTiles.map((t) => t.id);
      const existing = tileIds.length
        ? await db.select().from(completions).where(inArray(completions.tileId, tileIds))
        : [];
      const done = new Set(existing.map((c) => `${c.teamId}-${c.tileId}`));
      const event = await db.query.events.findFirst({ where: eq(events.id, activePlayer.eventId) });
      const team = await db.query.teams.findFirst({ where: eq(teams.id, activePlayer.teamId!) });

      for (const tile of statTiles) {
        const compKey = `${activePlayer.teamId}-${tile.id}`;
        if (done.has(compKey)) continue;
        // Event-rules gate: unrevealed/claimed tiles and lockout losses never credit, no matter
        // what the pushed stats say. Also freezes the rule-adjusted award for the insert below.
        const gate = event
          ? await evaluateCompletionGate({ event, tile, teamId: activePlayer.teamId! })
          : null;
        if (gate && !gate.allowed) continue;
        const keys = statKeys(tile.trackedStat);
        const individual = isIndividualMode(tile.trackingMode);
        // For an individual tile, the finisher is the player who reached the goal alone (attributed so the
        // activity feed can name them — a stat completion has no submission). Team tiles have no one player.
        const individualFinisher = individual
          ? teamPlayers.find((p) => gainFor(p, keys, tile.statType!) >= tile.statGoal!)
          : undefined;
        const meets = individual
          ? individualFinisher != null
          : teamPlayers.reduce((sum, p) => sum + gainFor(p, keys, tile.statType!), 0) >= tile.statGoal!;
        if (!meets) continue;

        // Freeze the per-member split at completion: the lone finisher for individual tiles, or every
        // contributing team member's current gain for team tiles. Locks "who got what %" against the
        // stat continuing to climb after the tile is done.
        const splitRows = individual
          ? [{ playerId: individualFinisher!.id, gained: gainFor(individualFinisher!, keys, tile.statType!) }]
          : teamPlayers.map((p) => ({ playerId: p.id, gained: gainFor(p, keys, tile.statType!) }));

        // Notify only on a genuine insert — the sweep + this push can both cross a threshold and
        // would otherwise double-ping Discord.
        const inserted = await db
          .insert(completions)
          .values({
            teamId: activePlayer.teamId!,
            tileId: tile.id,
            creditPlayerId: individualFinisher?.id ?? null,
            statContributions: JSON.stringify(buildContributionSnapshot(tile.statGoal!, splitRows)),
            awardedPoints: gate?.awardedPoints ?? null,
          })
          .onConflictDoNothing()
          .returning({ id: completions.id });
        if (inserted.length === 0) continue;
        if (gate?.bounty) handleBountyClaim(activePlayer.eventId, tile.id).catch(() => {});
        done.add(compKey);
        completed.push(tile.label);
        if (event && team) {
          notifyTileCompletion({
            clanId: clan.id,
            eventName: event.name,
            tileLabel: tile.label,
            teamName: team.name,
            teamColor: team.color,
            tileType: tile.tileType,
            trackedStat: tile.trackedStat,
            statType: tile.statType,
            eventId: event.id,
            tile,
          }).catch(() => {});
        }
      }
    }
  }

  // ── Weekly credit: move SOTW/BOTW live for any active comp whose metric was just pushed. Only when
  // the member is 'active' (unranked/banned rows are the sweep's job) and already baselined (a first
  // capture from a live push would zero the session — the sweep sets the baseline from max(hiscores,
  // live)). currentValue climbs monotonically; a stale-baseline flush is spike-flagged here too.
  if (memberRow?.status === 'active') {
    const activeComps = (await getActiveWeeklyMetrics(clan.id)).filter((c) => updatedKeys.has(c.metric));
    for (const comp of activeComps) {
      const participant = await db.query.weeklyParticipants.findFirst({
        where: and(
          eq(weeklyParticipants.competitionId, comp.id),
          eq(weeklyParticipants.clanMemberId, member.clanMemberId),
        ),
      });
      if (!participant) continue; // not enrolled yet — the lifecycle cron enrolls + the sweep baselines
      await applyWeeklyValue({
        participantId: participant.id,
        type: comp.type,
        metric: comp.metric,
        value: live[comp.metric] ?? 0,
        baselineValue: participant.baselineValue,
        currentValue: participant.currentValue,
        lastUpdated: participant.lastUpdated,
        allowFirstCapture: false,
        competitionStartIso: comp.startDate,
        now: nowIso,
      });
    }
  }

  return NextResponse.json({ ok: true, updated: Object.keys(pushed).length, completed });
}
