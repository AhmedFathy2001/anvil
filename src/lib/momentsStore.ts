import { db } from '@/db';
import { events, moments, players, settings, tiles, weeklyCompetitions, weeklyParticipants } from '@/db/schema';
import { and, desc, eq, inArray } from 'drizzle-orm';
import {
  classifyObservation,
  DEFAULT_MIN_LOOT_GP,
  type EventScope,
  type Observation,
  type PlannedMoment,
  type WeeklyScope,
} from '@/lib/moments';

/**
 * Storage and scope resolution for moments — the database half of lib/moments.
 *
 * Split from the rules so the rules stay testable without a database, which is the same split
 * lib/competitionAwards and lib/competitionView already use.
 */

/** Bingo hauls at or above this are kept whatever they came from. Clan-overridable. */
const MIN_LOOT_SETTING_KEY = 'moments_min_loot_gp';

export interface ActiveScopes {
  weeklies: WeeklyScope[];
  event: EventScope | null;
}

/**
 * What this member is currently part of.
 *
 * Enrollment matters: weekly competitions auto-enroll the roster, but a guest or a member who was
 * removed from one shouldn't appear on its board through a side door. The event is resolved exactly
 * as the counters ingest resolves it — drafted onto a team, event neither force-ended nor past.
 */
export async function activeScopesFor(clanMemberId: number, now: Date = new Date()): Promise<ActiveScopes> {
  const nowIso = now.toISOString();

  const weeklyRows = await db
    .select({
      id: weeklyCompetitions.id,
      type: weeklyCompetitions.type,
      metric: weeklyCompetitions.metric,
    })
    .from(weeklyParticipants)
    .innerJoin(weeklyCompetitions, eq(weeklyParticipants.competitionId, weeklyCompetitions.id))
    .where(
      and(
        eq(weeklyParticipants.clanMemberId, clanMemberId),
        eq(weeklyCompetitions.status, 'active'),
      ),
    );
  const weeklies: WeeklyScope[] = weeklyRows
    .filter((r): r is typeof r & { type: 'skill' | 'boss' | 'efficiency' } =>
      r.type === 'skill' || r.type === 'boss' || r.type === 'efficiency')
    .map((r) => ({ id: r.id, type: r.type, metric: r.metric }));

  const playerRows = await db
    .select({
      eventId: players.eventId,
      teamId: players.teamId,
      endDate: events.endDate,
      forceEndedAt: events.forceEndedAt,
    })
    .from(players)
    .innerJoin(events, eq(players.eventId, events.id))
    .where(eq(players.clanMemberId, clanMemberId));
  const active = playerRows.find((p) => p.teamId && !p.forceEndedAt && (!p.endDate || p.endDate > nowIso));

  const event = active ? await eventScope(active.eventId) : null;
  return { weeklies, event };
}

/**
 * What a board cares about: the sources its tiles name, and the items they want.
 *
 * Both are needed because most boards only set one. A drop tile usually names items and no source,
 * a kill tile names sources and no items — and a haul is interesting if the board recognises EITHER
 * half of it, including when nothing was credited (the tile was finished, the source was wrong, the
 * item was the other unique). That near-miss is precisely what a highlight feed is for.
 */
async function eventScope(eventId: number): Promise<EventScope> {
  const rows = await db
    .select({
      sourceNpcs: tiles.sourceNpcs,
      targetNpcs: tiles.targetNpcs,
      timedActivity: tiles.timedActivity,
      trackedItemIds: tiles.trackedItemIds,
      itemRequirements: tiles.itemRequirements,
    })
    .from(tiles)
    .where(eq(tiles.eventId, eventId));

  const sources = new Set<string>();
  const itemIds = new Set<number>();
  for (const row of rows) {
    for (const raw of [row.sourceNpcs, row.targetNpcs]) {
      for (const name of parseStringArray(raw)) {
        // PvP tiles reuse targetNpcs for "team:other" / "rsn:<name>" bounties, which are not sources.
        if (!name.includes(':')) sources.add(name);
      }
    }
    if (row.timedActivity) sources.add(row.timedActivity);
    for (const id of parseNumberArray(row.trackedItemIds)) itemIds.add(id);
    for (const req of parseItemRequirements(row.itemRequirements)) itemIds.add(req);
  }

  return {
    id: eventId,
    sources: [...sources],
    itemIds: [...itemIds],
    minLootGp: await minLootGp(),
  };
}

async function minLootGp(): Promise<number> {
  const row = await db.query.settings.findFirst({ where: eq(settings.key, MIN_LOOT_SETTING_KEY) });
  const parsed = row?.value ? Number(row.value) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_MIN_LOOT_GP;
}

function parseStringArray(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string' && v.length > 0) : [];
  } catch {
    return [];
  }
}

function parseNumberArray(raw: string | null): number[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is number => typeof v === 'number') : [];
  } catch {
    return [];
  }
}

function parseItemRequirements(raw: string | null): number[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((r) => (r && typeof r === 'object' ? (r as { itemId?: unknown }).itemId : null))
      .filter((v): v is number => typeof v === 'number');
  } catch {
    return [];
  }
}

/**
 * Classify a batch of observations and store whatever landed somewhere.
 *
 * Idempotent by construction: the scoped dedup key is unique per member, so a retry after a timeout,
 * a client restart replaying its queue, and the three chat lines one pet fires all collapse onto the
 * same rows. Returns how many were genuinely new so the client can log something true.
 */
export async function recordMoments(
  member: { clanMemberId: number; rsn: string },
  observations: Observation[],
  scopes: ActiveScopes,
): Promise<{ stored: number; matched: number }> {
  const planned: PlannedMoment[] = [];
  for (const obs of observations) planned.push(...classifyObservation(obs, scopes));
  if (planned.length === 0) return { stored: 0, matched: 0 };

  let stored = 0;
  for (const row of planned) {
    const inserted = await db
      .insert(moments)
      .values({
        clanMemberId: member.clanMemberId,
        rsn: member.rsn,
        kind: row.kind,
        weeklyCompetitionId: row.weeklyCompetitionId,
        eventId: row.eventId,
        itemId: row.itemId,
        itemName: row.itemName,
        quantity: row.quantity,
        valueGp: row.valueGp,
        source: row.source,
        sourceKind: row.sourceKind,
        kc: row.kc,
        rarityDenominator: row.rarityDenominator,
        tier: row.tier,
        occurredAt: row.occurredAt,
        dedupKey: row.dedupKey,
      })
      .onConflictDoNothing()
      .returning({ id: moments.id });
    if (inserted.length > 0) stored++;
  }
  return { stored, matched: planned.length };
}

export interface MomentRow {
  id: number;
  rsn: string;
  kind: string;
  itemId: number | null;
  itemName: string | null;
  quantity: number;
  valueGp: number | null;
  source: string | null;
  kc: number | null;
  rarityDenominator: number | null;
  /** Combat tasks only — the feed line leads with it. */
  tier: string | null;
  occurredAt: string;
}

/** A competition's feed, newest first. */
export async function momentsForCompetition(competitionId: number, limit = 12): Promise<MomentRow[]> {
  return db
    .select({
      id: moments.id,
      rsn: moments.rsn,
      kind: moments.kind,
      itemId: moments.itemId,
      itemName: moments.itemName,
      quantity: moments.quantity,
      valueGp: moments.valueGp,
      source: moments.source,
      kc: moments.kc,
      rarityDenominator: moments.rarityDenominator,
      tier: moments.tier,
      occurredAt: moments.occurredAt,
    })
    .from(moments)
    .where(eq(moments.weeklyCompetitionId, competitionId))
    .orderBy(desc(moments.occurredAt))
    .limit(limit);
}

/** A board's feed, newest first. */
export async function momentsForEvent(eventId: number, limit = 20): Promise<MomentRow[]> {
  return db
    .select({
      id: moments.id,
      rsn: moments.rsn,
      kind: moments.kind,
      itemId: moments.itemId,
      itemName: moments.itemName,
      quantity: moments.quantity,
      valueGp: moments.valueGp,
      source: moments.source,
      kc: moments.kc,
      rarityDenominator: moments.rarityDenominator,
      tier: moments.tier,
      occurredAt: moments.occurredAt,
    })
    .from(moments)
    .where(eq(moments.eventId, eventId))
    .orderBy(desc(moments.occurredAt))
    .limit(limit);
}

/**
 * Every moment a board produced, for the end-of-event summary (lib/momentsAnalytics).
 *
 * Unlimited on purpose — a count of deaths that quietly stopped at twenty would be a lie — but
 * capped high enough that a runaway feed can't hand the page a million rows.
 */
export async function allMomentsForEvent(eventId: number, cap = 5000): Promise<MomentRow[]> {
  return momentsForEvent(eventId, cap);
}

/**
 * Moments a member can see about themselves, across every scope — the profile fold.
 *
 * Unscoped rows are impossible by construction (nothing is stored that belonged to nothing), so
 * this is always "things that happened while something was running".
 */
export async function momentsForMembers(clanMemberIds: number[], limit = 20): Promise<MomentRow[]> {
  if (clanMemberIds.length === 0) return [];
  return db
    .select({
      id: moments.id,
      rsn: moments.rsn,
      kind: moments.kind,
      itemId: moments.itemId,
      itemName: moments.itemName,
      quantity: moments.quantity,
      valueGp: moments.valueGp,
      source: moments.source,
      kc: moments.kc,
      rarityDenominator: moments.rarityDenominator,
      tier: moments.tier,
      occurredAt: moments.occurredAt,
    })
    .from(moments)
    .where(inArray(moments.clanMemberId, clanMemberIds))
    .orderBy(desc(moments.occurredAt))
    .limit(limit);
}
