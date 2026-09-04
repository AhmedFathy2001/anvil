import { db } from '@/db';
import { getSetting, getSettingMap } from '@/lib/settings';
import { clanMemberships, events, moments, eventParticipants, tiles, weeklyCompetitions, weeklyParticipants } from '@/db/schema';
import { and, desc, eq, inArray } from 'drizzle-orm';
import {
  DEFAULT_CLAN_SCOPE,
  isClanWorthy,
  type ClanScope,
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

// The always-on feed's three floors. Separate keys from the board's because they answer a different
// question — "is this worth keeping on an ordinary day?" rather than "is this about our board?" —
// and a clan that wants a chatty board feed and a quiet clan one should be able to have both.
export const CLAN_MIN_LOOT_SETTING_KEY = 'moments_clan_min_loot_gp';
export const CLAN_MIN_CA_TIER_SETTING_KEY = 'moments_clan_min_ca_tier';
export const CLAN_DEATHS_SETTING_KEY = 'moments_clan_deaths';

export interface ActiveScopes {
  weeklies: WeeklyScope[];
  event: EventScope | null;
  /** The always-on backstop. Never null in practice — it is what catches a quiet week. */
  clan: ClanScope;
}

/**
 * What this member is currently part of.
 *
 * Enrollment matters: weekly competitions auto-enroll the roster, but a guest or a member who was
 * removed from one shouldn't appear on its board through a side door. The event is resolved exactly
 * as the counters ingest resolves it — drafted onto a team, event neither force-ended nor past.
 */
export async function activeScopesFor(clanMemberId: number, clanId: number, now: Date = new Date()): Promise<ActiveScopes> {
  const nowIso = now.toISOString();

  // clan-scope: global -- keyed by a SEAT, and a seat belongs to exactly one clan, so the clan rides along with the id.
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

  // clan-scope: global -- keyed by a SEAT, and a seat belongs to exactly one clan, so the clan rides along with the id.
  const playerRows = await db
    .select({
      eventId: eventParticipants.eventId,
      teamId: eventParticipants.teamId,
      endDate: events.endDate,
      forceEndedAt: events.forceEndedAt,
    })
    .from(eventParticipants)
    .innerJoin(events, eq(eventParticipants.eventId, events.id))
    .where(eq(eventParticipants.clanMemberId, clanMemberId));
  const active = playerRows.find((p) => p.teamId && !p.forceEndedAt && (!p.endDate || p.endDate > nowIso));

  // The team comes from the same row that decided the event is theirs, so the stamp and the scope
  // can never disagree about which side they were on.
  const event = active ? await eventScope(active.eventId, active.teamId, clanId) : null;
  return { weeklies, event, clan: await clanScope(clanId) };
}

/**
 * What a board cares about: the sources its tiles name, and the items they want.
 *
 * Both are needed because most boards only set one. A drop tile usually names items and no source,
 * a kill tile names sources and no items — and a haul is interesting if the board recognises EITHER
 * half of it, including when nothing was credited (the tile was finished, the source was wrong, the
 * item was the other unique). That near-miss is precisely what a highlight feed is for.
 */
async function eventScope(eventId: number, teamId: number | null, clanId: number): Promise<EventScope> {
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
    teamId,
    sources: [...sources],
    itemIds: [...itemIds],
    minLootGp: await minLootGp(clanId),
  };
}

/**
 * The clan's own floors, or the shipped defaults.
 *
 * Read per push rather than cached: these are three tiny reads on a route that already does several,
 * and a clan that has just turned deaths on should see the next one, not the one after a cache
 * expires.
 */
async function clanScope(clanId: number): Promise<ClanScope> {
  const byKey = await getSettingMap(clanId, [
    CLAN_MIN_LOOT_SETTING_KEY,
    CLAN_MIN_CA_TIER_SETTING_KEY,
    CLAN_DEATHS_SETTING_KEY,
  ]);

  const rawLoot = Number(byKey.get(CLAN_MIN_LOOT_SETTING_KEY));
  const rawTier = byKey.get(CLAN_MIN_CA_TIER_SETTING_KEY)?.trim();
  return {
    minLootGp: Number.isFinite(rawLoot) && rawLoot >= 0 ? rawLoot : DEFAULT_CLAN_SCOPE.minLootGp,
    // Blank means the default, the same as every other setting on that page — clearing a box should
    // restore what shipped, not silently switch a feature off. Turning combat tasks OFF is written
    // as a tier we can't rank ("none"), which reads as what it is and can't be reached by accident.
    minCaTier: rawTier ? rawTier : DEFAULT_CLAN_SCOPE.minCaTier,
    deaths: byKey.has(CLAN_DEATHS_SETTING_KEY)
      ? byKey.get(CLAN_DEATHS_SETTING_KEY) === 'on'
      : DEFAULT_CLAN_SCOPE.deaths,
  };
}

async function minLootGp(clanId: number): Promise<number> {
  const value = await getSetting(clanId, MIN_LOOT_SETTING_KEY);
  const parsed = value ? Number(value) : NaN;
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
        teamId: row.teamId,
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

/** The columns every feed reads. One list so a new one can't quietly drift from the others. */
const MOMENT_COLUMNS = {
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
  sourceKind: moments.sourceKind,
  teamId: moments.teamId,
  occurredAt: moments.occurredAt,
};

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
  /** 'level' reads this to tell a 99 from a total-level milestone from a max. */
  sourceKind: string | null;
  /** Which side it happened on, stamped at ingest. Null on weekly/solo moments. */
  teamId: number | null;
  occurredAt: string;
}

/** A competition's feed, newest first. */
export async function momentsForCompetition(competitionId: number, limit = 12): Promise<MomentRow[]> {
  return db
    .select(MOMENT_COLUMNS)
    .from(moments)
    .where(eq(moments.weeklyCompetitionId, competitionId))
    .orderBy(desc(moments.occurredAt))
    .limit(limit);
}

/** A board's feed, newest first. */
export async function momentsForEvent(eventId: number, limit = 20): Promise<MomentRow[]> {
  return db
    .select(MOMENT_COLUMNS)
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
/**
 * The clan's always-on feed: everything worth keeping, whether or not a board was running.
 *
 * Scoped by joining through the SEAT, because that is what a moment is stamped with and a seat
 * belongs to exactly one clan — a straight column filter would need a clan_id on moments that the
 * ingest has no reason to write twice.
 *
 * The cost is over-reading — the bar can reject most of a busy board's week — so the query takes a
 * window several times the asked-for size and stops there rather than paging until it fills. A feed
 * that comes back short is telling the truth about a quiet stretch.
 */
export async function momentsForClan(clanId: number, limit = 20): Promise<MomentRow[]> {
  const clan = await clanScope(clanId);
  const window = Math.min(limit * 12, 600);
  const rows = await db
    .select(MOMENT_COLUMNS)
    .from(moments)
    .innerJoin(clanMemberships, eq(moments.clanMemberId, clanMemberships.id))
    .where(eq(clanMemberships.clanId, clanId))
    .orderBy(desc(moments.occurredAt))
    .limit(window);
  return rows.filter((row) => isClanWorthy(row, clan)).slice(0, limit);
}

export async function momentsForMembers(clanMemberIds: number[], limit = 20): Promise<MomentRow[]> {
  if (clanMemberIds.length === 0) return [];
  return db
    .select(MOMENT_COLUMNS)
    .from(moments)
    .where(inArray(moments.clanMemberId, clanMemberIds))
    .orderBy(desc(moments.occurredAt))
    .limit(limit);
}
