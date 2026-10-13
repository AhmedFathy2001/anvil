// Event luck: who was spooned and who was dry DURING one event, and the same people's lifetime luck.
// The rules are in lib/eventLuckRules; this loads their inputs.

import { and, eq, inArray, isNotNull } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, clanMemberships, eventParticipants, events, memberClog, moments, teams } from '@/db/schema';
import { countedLuckCandidates, lifetimeBoardsFor, type LuckBoards } from '@/lib/clogLuckBoard';
import { clogPageIndex } from '@/lib/clogDataset';
import { buildLuckBoards, type LuckEntry } from '@/lib/clogProfile';
import { countEventDrops, eventBossGains, shapeEventLuck } from '@/lib/eventLuckRules';

export interface EventLuck {
  thisEvent: {
    dry: LuckEntry[];
    spooned: LuckEntry[];
    /** Participants whose plugin reported during the event — the only ones we can judge. */
    judged: number;
    participants: number;
  };
  lifetime: LuckBoards;
  /** accountId → team, for colouring rows. */
  teamOf: Record<number, { name: string; color: string }>;
}

/**
 * An event page is opened far more often than its inputs move — kills arrive with the sweep and
 * pushes, drops a few an hour — so a result is reused for a few minutes rather than recomputed for
 * every viewer of a 1,200-player board.
 */
const CACHE_MS = 5 * 60_000;
const cache = new Map<string, { at: number; value: EventLuck | null }>();

export async function getEventLuck(eventId: number, limit = 10): Promise<EventLuck | null> {
  const key = `${eventId}:${limit}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  const value = await computeEventLuck(eventId, limit);
  cache.set(key, { at: Date.now(), value });
  if (cache.size > 200) cache.delete(cache.keys().next().value!);
  return value;
}

async function computeEventLuck(eventId: number, limit: number): Promise<EventLuck | null> {
  // clan-scope: this clan -- the caller resolved the event through the addressed clan (eventScope).
  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event?.startDate) return null;

  const rows = await db
    .select({
      accountId: eventParticipants.accountId,
      name: eventParticipants.name,
      teamId: eventParticipants.teamId,
      statsSnapshot: eventParticipants.statsSnapshot,
      cachedStats: eventParticipants.cachedStats,
      pluginStats: eventParticipants.pluginStats,
      frozenStats: eventParticipants.frozenStats,
    })
    .from(eventParticipants)
    .where(and(eq(eventParticipants.eventId, eventId), isNotNull(eventParticipants.accountId)));
  // One row per account: a person entered twice on one account is still one set of kills and drops.
  const byAccount = new Map<number, (typeof rows)[number] & { accountId: number }>();
  for (const r of rows) if (r.accountId != null && !byAccount.has(r.accountId)) byAccount.set(r.accountId, { ...r, accountId: r.accountId });
  const participants = [...byAccount.values()];
  const accountIds = participants.map((p) => p.accountId);

  const teamRows = await db.select({ id: teams.id, name: teams.name, color: teams.color }).from(teams).where(eq(teams.eventId, eventId));
  const teamById = new Map(teamRows.map((t) => [t.id, t]));
  const teamOf: EventLuck['teamOf'] = {};
  for (const p of participants) {
    const t = p.teamId != null ? teamById.get(p.teamId) : undefined;
    if (t) teamOf[p.accountId] = { name: t.name, color: t.color };
  }

  const candidates = await countedLuckCandidates(event.clanId);
  const empty = { dry: [], spooned: [], judged: 0, participants: participants.length };
  if (accountIds.length === 0 || candidates.length === 0) {
    return { thisEvent: empty, lifetime: { dry: [], spooned: [], membersConsidered: 0, itemsConsidered: candidates.length }, teamOf };
  }

  const [accountRows, momentRows, syncedRows] = await Promise.all([
    db
      .select({ id: accounts.id, liveStats: accounts.liveStats, liveStatsAt: accounts.liveStatsAt })
      .from(accounts)
      .where(inArray(accounts.id, accountIds)),
    // clan-scope: this clan -- scoped by moments.eventId; seats span clans when co-hosted, by design.
    db
      .select({ accountId: clanMemberships.accountId, kind: moments.kind, itemId: moments.itemId, source: moments.source })
      .from(moments)
      .innerJoin(clanMemberships, eq(clanMemberships.id, moments.clanMemberId))
      .where(eq(moments.eventId, eventId)),
    db.select({ id: memberClog.accountId }).from(memberClog).where(inArray(memberClog.accountId, accountIds)),
  ]);

  // Judged = the plugin pushed after the whistle. Without it we saw none of their drops.
  const start = Date.parse(event.startDate);
  const judged = new Set(
    accountRows.filter((a) => a.liveStatsAt && Date.parse(a.liveStatsAt) >= start).map((a) => a.id),
  );

  const bossKeys = [...new Set(candidates.flatMap((c) => c.sources.map((s) => s.bossKey)))];
  const withGains = participants.map((p) => ({ accountId: p.accountId, name: p.name, gains: eventBossGains(p, bossKeys) }));
  const drops = countEventDrops(
    momentRows.filter((m) => byAccount.has(m.accountId)),
    candidates,
    clogPageIndex().get('All Pets') ?? new Set<number>(),
  );
  // No rotation: an event's board is a record of that event, the same every time it is opened.
  const boards = buildLuckBoards(shapeEventLuck(candidates, withGains, drops, judged), limit);

  const live = new Map(accountRows.map((a) => [a.id, a.liveStats]));
  const synced = syncedRows.map((r) => ({ id: r.id, rsn: byAccount.get(r.id)?.name ?? '', liveStats: live.get(r.id) ?? null }));
  const lifetime = await lifetimeBoardsFor(candidates, synced, limit);

  return { thisEvent: { ...boards, judged: judged.size, participants: participants.length }, lifetime, teamOf };
}
