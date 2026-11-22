import { and, eq, inArray, isNotNull, isNull, or } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, eventParticipants, submissions, teams, type events } from '@/db/schema';
import { clogTileGroups, clogTileItemIds, clogTileSpec, ownedAtStart } from '@/lib/clogTiles';
import { memberClogLog } from '@/lib/clogTileCredit';
import { parseStamp } from '@/lib/dbTime';
import { pluginSeenFor } from '@/lib/pluginSeen';
import { statSnapshotOf } from '@/lib/roster';
import {
  clogOwnedPagesVerdict,
  clogOwnedSlotsVerdict,
  clogSyncedVerdict,
  hiscoresRankedVerdict,
  pluginSeenVerdict,
  pluginVersionVerdict,
  raidPluginVerdict,
  type CheckVerdict,
} from '@/lib/tileRequirementChecks';
import { parseConditions } from '@/lib/tileConditions';
import { RAID_FACTS_MIN_PLUGIN, startCountOfSnapshot, takeSentence, teamTakeLine, tileStartKeys, tileStartWhat } from '@/lib/tileConditionsCheck';
import { isIndividualMode } from '@/lib/statTracking';
import { CLOG_TILE_MIN_PLUGIN, tileNeeds, type NeedCheck, type TileNeeds, type TileNeedsLike } from '@/lib/tileRequirements';

// "Before you start", the per-player half: run a tile's checks (lib/tileRequirements) for the VIEWING
// player's own characters on this event. Server-only; the verdicts themselves are pure
// (lib/tileRequirementChecks). Reads nothing about anyone else, so the only thing the caller has to
// settle is that the viewer may see the tile at all.

export interface ReadinessResult {
  /** The tile or combo part the check belongs to. */
  tileId: number;
  check: NeedCheck;
  status: CheckVerdict['status'];
  text: string;
}

type EventRow = typeof events.$inferSelect;
type ReadinessTile = TileNeedsLike & { id: number; parts?: (TileNeedsLike & { id: number })[] | null };

/** Which checks each tile id (the tile, or each combo part) asks for. */
export function checksByTile(tile: ReadinessTile, needs: TileNeeds = tileNeeds(tile)): Map<number, Set<NeedCheck>> {
  const out = new Map<number, Set<NeedCheck>>();
  const add = (id: number | undefined, n: TileNeeds) => {
    if (id == null) return;
    for (const x of [...n.requirements, ...n.limitations]) {
      if (!x.check) continue;
      const set = out.get(id) ?? new Set<NeedCheck>();
      set.add(x.check);
      out.set(id, set);
    }
  };
  add(tile.id, needs);
  for (const p of needs.parts ?? []) add(p.id, p.needs);
  return out;
}

export async function tileReadiness(args: {
  event: Pick<EventRow, 'id' | 'startDate'>;
  tile: ReadinessTile;
  /** The viewer's PERSON id (UserPayload.playerId). */
  personId: number;
  nowMs?: number;
}): Promise<ReadinessResult[]> {
  const { event, tile, personId } = args;
  const nowMs = args.nowMs ?? Date.now();
  const wanted = checksByTile(tile);
  if (wanted.size === 0) return [];

  // The viewer's own characters on this board.
  const mine = await db
    .select({ participantId: eventParticipants.id, accountId: accounts.id, rsn: accounts.rsn, status: accounts.status, teamId: eventParticipants.teamId, startStats: eventParticipants.statsSnapshot })
    .from(eventParticipants)
    .innerJoin(accounts, eq(accounts.id, eventParticipants.accountId))
    .where(and(eq(eventParticipants.eventId, event.id), eq(accounts.playerId, personId)));
  if (mine.length === 0) return [];

  const all = new Set([...wanted.values()].flatMap((s) => [...s]));
  const accountIds = mine.map((m) => m.accountId);
  const seen = all.has('plugin-seen') || all.has('plugin-version') || all.has('raid-plugin-version') ? await pluginSeenFor(accountIds) : new Map();
  const wantsClog = all.has('clog-synced') || all.has('clog-owned');
  const logs = wantsClog ? new Map(await Promise.all(accountIds.map(async (id) => [id, await memberClogLog(id)] as const))) : new Map();
  const snapshots = all.has('hiscores-ranked')
    ? new Map(await Promise.all(accountIds.map(async (id) => [id, await statSnapshotOf(id)] as const)))
    : new Map<number, string | null>();
  const startMs = parseStamp(event.startDate) ?? nowMs;

  // Slots this tile (or part) already credited the viewer: proven new, never "owned before".
  const tileIds = [...wanted.keys()];
  const participantIds = mine.map((m) => m.participantId);
  const credited = all.has('clog-owned')
    ? await db
        .select({ tileId: submissions.tileId, itemId: submissions.itemId })
        .from(submissions)
        .where(
          and(
            inArray(submissions.tileId, tileIds),
            isNull(submissions.goal),
            isNotNull(submissions.itemId),
            or(inArray(submissions.creditPlayerId, participantIds), and(isNull(submissions.creditPlayerId), inArray(submissions.playerId, participantIds))),
          ),
        )
    : [];

  const byId = new Map<number, TileNeedsLike>([[tile.id, tile], ...(tile.parts ?? []).map((p) => [p.id, p] as [number, TileNeedsLike])]);
  const out: ReadinessResult[] = [];
  for (const [tileId, checks] of wanted) {
    const t = byId.get(tileId);
    if (!t) continue;
    for (const check of checks) {
      for (const m of mine) {
        const v = verdictFor(check, t, m, { seen, logs, snapshots, startMs, nowMs, credited: credited.filter((c) => c.tileId === tileId) });
        if (!v) continue;
        out.push({ tileId, check, status: v.status, text: mine.length > 1 ? `${m.rsn}: ${v.text}` : v.text });
      }
      // A start-count tile on a team board: who on the viewer's team can take it (the Board mockup's
      // "3 of 5 on Team Bandos can take it"). Names and yes/no only, never a teammate's count.
      if (check === 'start-count' && !isIndividualMode(t.trackingMode)) out.push(...(await teamTakeResults(event.id, tileId, t, mine)));
    }
  }
  return out;
}

async function teamTakeResults(
  eventId: number,
  tileId: number,
  t: TileNeedsLike,
  mine: { teamId: number | null }[],
): Promise<ReadinessResult[]> {
  const bar = parseConditions(t.conditions)?.startCount;
  const teamIds = [...new Set(mine.map((m) => m.teamId).filter((id): id is number => id != null))];
  if (!bar || teamIds.length === 0) return [];
  const keys = tileStartKeys(t);
  const rows = await db
    .select({ teamId: eventParticipants.teamId, name: eventParticipants.name, startStats: eventParticipants.statsSnapshot, teamName: teams.name })
    .from(eventParticipants)
    .innerJoin(teams, eq(teams.id, eventParticipants.teamId))
    .where(and(eq(eventParticipants.eventId, eventId), inArray(eventParticipants.teamId, teamIds)));
  const out: ReadinessResult[] = [];
  for (const teamId of teamIds) {
    const members = rows.filter((r) => r.teamId === teamId);
    if (members.length < 2) continue;
    const line = teamTakeLine(members[0].teamName ?? 'your team', members.map((r) => ({ name: r.name, start: startCountOfSnapshot(r.startStats, keys) })), bar);
    out.push({ tileId, check: 'start-count', status: 'unknown', text: line });
  }
  return out;
}

function verdictFor(
  check: NeedCheck,
  tile: TileNeedsLike,
  m: { accountId: number; status: string; startStats?: string | null },
  ctx: {
    seen: Map<number, { version: string; seenAt: string }>;
    logs: Map<number, { synced: boolean; rows: { itemId: number; firstSeenAt: string | null }[] }>;
    snapshots: Map<number, string | null>;
    startMs: number;
    nowMs: number;
    credited: { itemId: number | null }[];
  },
): CheckVerdict | null {
  switch (check) {
    case 'plugin-seen':
      return pluginSeenVerdict(ctx.seen.get(m.accountId) ?? null, ctx.nowMs);
    case 'plugin-version':
      return pluginVersionVerdict(ctx.seen.get(m.accountId) ?? null, CLOG_TILE_MIN_PLUGIN);
    case 'raid-plugin-version':
      return raidPluginVerdict(ctx.seen.get(m.accountId) ?? null, RAID_FACTS_MIN_PLUGIN);
    case 'start-count': {
      // The count is the one recorded for this board when it started (event_participants.stats_snapshot).
      const bar = parseConditions(tile.conditions)?.startCount;
      if (!bar) return null;
      const { what, noun } = tileStartWhat(tile);
      const v = takeSentence(bar, startCountOfSnapshot(m.startStats, tileStartKeys(tile)), what, noun);
      return { status: v.ok ? 'ok' : 'problem', text: v.text };
    }
    case 'clog-synced':
      return clogSyncedVerdict(!!ctx.logs.get(m.accountId)?.synced);
    case 'clog-owned': {
      const log = ctx.logs.get(m.accountId);
      const proven = new Set(ctx.credited.map((c) => c.itemId).filter((id): id is number => id != null));
      const owned = ownedAtStart(log?.rows ?? [], ctx.startMs, proven);
      const spec = clogTileSpec(tile);
      if (spec.mode === 'complete') return clogOwnedPagesVerdict({ synced: !!log?.synced, groups: clogTileGroups(spec), ownedAtStart: owned });
      return clogOwnedSlotsVerdict({ synced: !!log?.synced, pool: clogTileItemIds(spec), ownedAtStart: owned });
    }
    case 'hiscores-ranked': {
      const raw = ctx.snapshots.get(m.accountId) ?? null;
      let snapshot = null;
      try {
        snapshot = raw ? JSON.parse(raw) : null;
      } catch {
        snapshot = null;
      }
      return hiscoresRankedVerdict({ accountStatus: m.status, snapshot, statType: tile.statType, trackedStat: tile.trackedStat });
    }
  }
}
