import { db } from '@/db';
import { isTileRevealed, parseEventRules } from '@/lib/eventRules';
import { ttlMemo } from '@/lib/ttlMemo';
import { countedLuckCandidates } from '@/lib/clogLuckBoard';
import { getSetting, getSettingMap } from '@/lib/settings';
// Setting names only; pluginConfig is a heavy module, but momentsStore is server-side already.
import { DROP_RARITY_FLOOR_SETTING_KEY } from '@/lib/pluginConfig';
import { clanMemberships, events, moments, eventParticipants, tiles, weeklyCompetitions, weeklyParticipants } from '@/db/schema';
import { type SQL, and, asc, count, desc, eq, gte, inArray, isNotNull, isNull, like, lt, ne, or } from 'drizzle-orm';
import { LEVEL_RULES_SETTING_KEY } from '@/lib/levelRulesStore';
import { parseMilestoneRules } from '@/lib/levelRules';
import { eventHasStarted } from '@/lib/completionGate';
import { parseStamp } from '@/lib/dbTime';
import { MILESTONE_KIND, type MilestoneFacts } from '@/lib/milestoneMoments';
import {
  ACHIEVEMENT_KINDS,
  DEFAULT_CLAN_SCOPE,
  isAchievementKind,
  isClanWorthy,
  isEventFeedWorthy,
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
export async function activeScopesFor(
  clanMemberId: number,
  clanId: number,
  now: Date = new Date(),
  /** Which participant rows count as this member's — lib/auth pluginParticipantScope for plugin
   *  pushes, so a co-host's members (seated in the HOST clan) find their board. Defaults to the seat. */
  participantScope?: SQL,
): Promise<ActiveScopes> {
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
      startDate: events.startDate,
      endDate: events.endDate,
      forceEndedAt: events.forceEndedAt,
    })
    .from(eventParticipants)
    .innerJoin(events, eq(eventParticipants.eventId, events.id))
    .where(participantScope ?? eq(eventParticipants.clanMemberId, clanMemberId));
  // STARTED, not merely un-ended. A revealed board is still only a preview until the whistle. Use
  // the shared parser rather than comparing timestamp strings: Postgres defaults use a space while
  // browser-authored dates use ISO `T`, and lexicographic comparisons disagree on same-day times.
  const active = playerRows.find(
    (p) =>
      p.teamId &&
      !p.forceEndedAt &&
      eventHasStarted(p, now.getTime()) &&
      (!p.endDate || (parseStamp(p.endDate) ?? 0) > now.getTime()),
  );

  // The team comes from the same row that decided the event is theirs, so the stamp and the scope
  // can never disagree about which side they were on.
  const event = active ? await eventScope(active.eventId, active.teamId, clanId, active.startDate!) : null;
  return { weeklies, event, clan: await clanScope(clanId) };
}

/**
 * The items a board's tiles want (a drop tile's items, a tile's tracked items). Its Feed shows any of
 * them whatever they're worth: five whips toward a whip tile are the board's news even under the
 * value floor. Held two minutes.
 */
export function boardTileItemIds(eventId: number): Promise<Set<number>> {
  return ttlMemo(
    `board-tile-items:${eventId}`,
    async () => {
      // clan-scope: global -- by the board id the caller already resolved.
      const ev = await db.query.events.findFirst({ where: eq(events.id, eventId), columns: { tilesRevealed: true, rules: true } });
      // Only tiles members can see: a hidden tile's items let through would say it exists.
      if (!ev?.tilesRevealed) return new Set<number>();
      const rules = parseEventRules(ev.rules);
      const rows = await db
        .select({
          trackedItemIds: tiles.trackedItemIds,
          itemRequirements: tiles.itemRequirements,
          revealedAt: tiles.revealedAt,
          mission: tiles.mission,
        })
        .from(tiles)
        .where(eq(tiles.eventId, eventId));
      const ids = new Set<number>();
      for (const row of rows.filter((t) => isTileRevealed(rules, t))) {
        for (const id of parseNumberArray(row.trackedItemIds)) ids.add(id);
        for (const id of parseItemRequirements(row.itemRequirements)) ids.add(id);
      }
      return ids;
    },
    2 * 60_000,
  );
}

/**
 * What a board cares about: the sources its tiles name, and the items they want.
 *
 * Both are needed because most boards only set one. A drop tile usually names items and no source,
 * a kill tile names sources and no items — and a haul is interesting if the board recognises EITHER
 * half of it, including when nothing was credited (the tile was finished, the source was wrong, the
 * item was the other unique). That near-miss is precisely what a highlight feed is for.
 */
async function eventScope(eventId: number, teamId: number | null, clanId: number, startedAt: string): Promise<EventScope> {
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
    startedAt,
    teamId,
    sources: [...sources],
    itemIds: [...itemIds],
    minLootGp: await minLootGp(clanId),
    luckItemIds: [...new Set((await countedLuckCandidates(clanId)).map((c) => c.itemId))],
  };
}

/**
 * The clan's own floors, or the shipped defaults.
 *
 * Read per push rather than cached: these are three tiny reads on a route that already does several,
 * and a clan that has just turned deaths on should see the next one, not the one after a cache
 * expires.
 */
/** A clan's feed floors (loot gp, combat-task tier, deaths), as its settings say. */
export function clanScopeFor(clanId: number): Promise<ClanScope> {
  return clanScope(clanId);
}

async function clanScope(clanId: number): Promise<ClanScope> {
  const byKey = await getSettingMap(clanId, [
    CLAN_MIN_LOOT_SETTING_KEY,
    CLAN_MIN_CA_TIER_SETTING_KEY,
    CLAN_DEATHS_SETTING_KEY,
    DROP_RARITY_FLOOR_SETTING_KEY,
    LEVEL_RULES_SETTING_KEY,
  ]);
  const rawRarity = Number(byKey.get(DROP_RARITY_FLOOR_SETTING_KEY));

  const rawLoot = Number(byKey.get(CLAN_MIN_LOOT_SETTING_KEY));
  const rawTier = byKey.get(CLAN_MIN_CA_TIER_SETTING_KEY)?.trim();
  return {
    minLootGp: Number.isFinite(rawLoot) && rawLoot >= 0 ? rawLoot : DEFAULT_CLAN_SCOPE.minLootGp,
    // Blank means the default, the same as every other setting on that page — clearing a box should
    // restore what shipped, not silently switch a feature off. Turning combat tasks OFF is written
    // as a tier we can't rank ("none"), which reads as what it is and can't be reached by accident.
    minCaTier: rawTier ? rawTier : DEFAULT_CLAN_SCOPE.minCaTier,
    // The admin toggle writes 'true'/'false' (components/ToggleSetting); 'on' is the older spelling.
    deaths: byKey.get(CLAN_DEATHS_SETTING_KEY)
      ? ['true', '1', 'on'].includes(byKey.get(CLAN_DEATHS_SETTING_KEY)!.trim().toLowerCase())
      : DEFAULT_CLAN_SCOPE.deaths,
    // The same floor (and the same clamp) as the Discord rare-drops channel: pluginConfig getDropRarityFloor.
    minRarity: Number.isFinite(rawRarity) && rawRarity > 0 ? Math.max(1000, Math.round(rawRarity)) : DEFAULT_CLAN_SCOPE.minRarity,
    // The level-ups its levels channel announces (lib/levelRules) are the ones its feed keeps.
    levelRules: parseMilestoneRules(byKey.get(LEVEL_RULES_SETTING_KEY)),
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
  mode?: { key: string; label: string } | null,
): Promise<{ stored: number; matched: number; inserted: StoredMoment[] }> {
  const planned: PlannedMoment[] = [];
  for (const obs of observations) {
    // A client retries a short backlog after reconnecting. If it reconnects just after the event
    // starts, those pre-start observations must not be filed onto the newly-live board.
    const eventStart = scopes.event?.startedAt ? parseStamp(scopes.event.startedAt) : null;
    const occurred = parseStamp(obs.occurredAt);
    const event = eventStart != null && (occurred == null || occurred < eventStart) ? null : scopes.event;
    planned.push(...classifyObservation(obs, { ...scopes, event }));
  }
  if (planned.length === 0) return { stored: 0, matched: 0, inserted: [] };

  let stored = 0;
  const inserted: StoredMoment[] = [];
  for (const row of planned) {
    // An achievement happens once, so it is one row for the clan feed whichever scope kept it: the
    // clan's own copy (':clan') is skipped when a board or week already holds it, and a board's or
    // week's when the clan already has it — a 99 reported during a week and replayed after it ended
    // would otherwise read twice. (A week and a board both keeping it is their own business.)
    if (!mode && isAchievementKind(row.kind) && (await achievementHeld(member.clanMemberId, row.dedupKey))) continue;
    const dedupKey = mode ? `mode:${mode.key}:${row.dedupKey}` : row.dedupKey;
    const rows = await db
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
        worldMode: mode?.key ?? null,
        worldModeLabel: mode?.label ?? null,
        occurredAt: row.occurredAt,
        dedupKey,
      })
      .onConflictDoNothing()
      .returning({ id: moments.id, occurredAt: moments.occurredAt });
    if (rows.length > 0) {
      stored++;
      inserted.push({
        id: rows[0].id,
        rsn: member.rsn,
        kind: row.kind,
        itemId: row.itemId,
        itemName: row.itemName,
        quantity: row.quantity,
        valueGp: row.valueGp,
        source: row.source,
        sourceKind: row.sourceKind,
        teamId: row.teamId,
        eventId: row.eventId,
        tier: row.tier,
        worldMode: mode?.key ?? null,
        worldModeLabel: mode?.label ?? null,
        kc: row.kc,
        occurredAt: rows[0].occurredAt,
      });
    }
  }
  return { stored, matched: planned.length, inserted };
}

/**
 * Keep notable activity from a separate-save world in its own clan timeline. It deliberately gets
 * no board or weekly scope: those saves never become main-game progress merely because a board is
 * running. The clan's existing floors still decide what is worth retaining.
 */
export async function recordModeMoments(
  member: { clanMemberId: number; rsn: string },
  observations: Observation[],
  clan: ClanScope,
  mode: { key: string; label: string },
): Promise<{ stored: number; matched: number; inserted: StoredMoment[]; seatKind: string; idle: true }> {
  const seat = await db.query.clanMemberships.findFirst({ where: eq(clanMemberships.id, member.clanMemberId), columns: { kind: true } });
  const seatKind = seat?.kind ?? 'guest';
  if (seatKind !== 'member') return { stored: 0, matched: 0, inserted: [], seatKind, idle: true };
  const kept = observations.filter((o) => classifyObservation(o, { weeklies: [], event: null, clan }).length > 0);
  if (!kept.length) return { stored: 0, matched: 0, inserted: [], seatKind, idle: true };
  return { ...(await recordMoments(member, kept, { weeklies: [], event: null, clan }, mode)), seatKind, idle: true };
}

/** Persist the mode-only unlocks that arrive through /mode-lines rather than the normal moments push. */
export async function recordModeLineMoments(
  member: { clanMemberId: number; rsn: string },
  mode: { key: string; label: string },
  events: readonly { kind: 'mode' | 'level' | 'quest'; title: string; itemName?: string | null; quantity?: number; sourceKind?: string | null }[],
): Promise<StoredMoment[]> {
  const seat = await db.query.clanMemberships.findFirst({ where: eq(clanMemberships.id, member.clanMemberId), columns: { kind: true } });
  if (seat?.kind !== 'member') return [];
  const inserted: StoredMoment[] = [];
  const occurredAt = new Date().toISOString();
  for (const e of events) {
    const key = e.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100) || 'event';
    const [row] = await db
      .insert(moments)
      .values({
        clanMemberId: member.clanMemberId,
        rsn: member.rsn,
        kind: e.kind,
        weeklyCompetitionId: null,
        eventId: null,
        teamId: null,
        itemId: null,
        itemName: e.itemName ?? e.title,
        quantity: e.quantity ?? 1,
        valueGp: null,
        source: null,
        sourceKind: e.sourceKind ?? (e.kind === 'mode' ? 'mode' : null),
        kc: null,
        rarityDenominator: null,
        tier: null,
        worldMode: mode.key,
        worldModeLabel: mode.label,
        occurredAt,
        dedupKey: `mode:${mode.key}:line:${e.kind}:${key}`,
      })
      .onConflictDoNothing()
      .returning({ id: moments.id });
    if (!row) continue;
    inserted.push({
      id: row.id, rsn: member.rsn, kind: e.kind, itemId: null, itemName: e.itemName ?? e.title,
      quantity: e.quantity ?? 1, valueGp: null, source: null, sourceKind: e.sourceKind ?? (e.kind === 'mode' ? 'mode' : null),
      teamId: null, eventId: null, tier: null, worldMode: mode.key, worldModeLabel: mode.label, kc: null, occurredAt,
    });
  }
  return inserted;
}

/**
 * A shared line kind's row in the clan feed (lib/milestoneMoments), for a MEMBER seat only: Slayer,
 * clues, speedruns, kill counts, BA gambles, the clan's patterns. The notify route records it only
 * after vetting the line against the player's own settings in force, so an off kind makes no row.
 * Deduped within the minute (the outbox may resend a post).
 */
export async function recordMilestoneMoment(member: { clanMemberId: number; rsn: string }, f: MilestoneFacts): Promise<StoredMoment[]> {
  const seat = await db.query.clanMemberships.findFirst({ where: eq(clanMemberships.id, member.clanMemberId), columns: { kind: true } });
  if (seat?.kind !== 'member') return [];
  const occurredAt = new Date().toISOString();
  const key = f.itemName.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60);
  const [row] = await db
    .insert(moments)
    .values({
      clanMemberId: member.clanMemberId, rsn: member.rsn, kind: MILESTONE_KIND, weeklyCompetitionId: null, eventId: null, teamId: null,
      itemId: null, itemName: f.itemName, quantity: f.quantity, valueGp: null, source: null, sourceKind: f.sub, kc: null,
      rarityDenominator: null, tier: f.tier, occurredAt,
      dedupKey: `milestone:${f.sub}:${key}:${f.quantity}:${Math.floor(Date.now() / 60_000)}`,
    })
    .onConflictDoNothing()
    .returning({ id: moments.id });
  if (!row) return [];
  return [{
    id: row.id, rsn: member.rsn, kind: MILESTONE_KIND, itemId: null, itemName: f.itemName, quantity: f.quantity, valueGp: null,
    source: null, sourceKind: f.sub, teamId: null, eventId: null, tier: f.tier, worldMode: null, worldModeLabel: null, kc: null, occurredAt,
  }];
}

/**
 * What the plugin's moments route stores for one seat's push.
 *
 * With a board or week running, everything goes through {@link recordMoments} as it always has. With
 * nothing running only the clan scope is left, and it keeps ACHIEVEMENTS alone (lib/moments
 * ACHIEVEMENT_KINDS — drops and pets still need something running), and only for a MEMBER seat: a
 * guest seat is somebody visiting for a board, and their milestones are their own clan's news.
 */
export async function recordSeatMoments(
  member: { clanMemberId: number; rsn: string },
  observations: Observation[],
  scopes: ActiveScopes,
): Promise<{ stored: number; matched: number; inserted: StoredMoment[]; seatKind: string; idle: boolean }> {
  const idle = scopes.weeklies.length === 0 && !scopes.event;
  // clan-scope: global -- keyed by a SEAT, and a seat belongs to exactly one clan
  const seat = await db.query.clanMemberships.findFirst({ where: eq(clanMemberships.id, member.clanMemberId), columns: { kind: true } });
  const seatKind = seat?.kind ?? 'guest';
  // A death is kept with nothing running too, when the clan keeps deaths (it's the clan's feed either way).
  const kept = idle
    ? seatKind === 'member'
      ? observations.filter((o) => isAchievementKind(o.kind) || (o.kind === 'death' && scopes.clan.deaths))
      : []
    : observations;
  if (kept.length === 0) return { stored: 0, matched: 0, inserted: [], seatKind, idle };
  return { ...(await recordMoments(member, kept, scopes)), seatKind, idle };
}

/** The scope suffix classifyObservation puts on a dedup key: ':clan', ':w<id>' or ':e<id>'. */
const SCOPE_SUFFIX = /:(clan|w\d+|e\d+)$/;

/**
 * Whether this member already has the achievement the key names, in the scope that would make a
 * second row a duplicate on the clan feed (see recordMoments).
 */
async function achievementHeld(clanMemberId: number, dedupKey: string): Promise<boolean> {
  const m = SCOPE_SUFFIX.exec(dedupKey);
  if (!m) return false;
  const base = dedupKey.slice(0, m.index);
  const clanCopy = `${base}:clan`;
  // LIKE wildcards in a client key are matched literally.
  const pattern = `${base.replace(/[\\%_]/g, (c) => `\\${c}`)}:%`;
  const where =
    m[1] === 'clan'
      ? and(eq(moments.clanMemberId, clanMemberId), like(moments.dedupKey, pattern), ne(moments.dedupKey, clanCopy))
      : and(eq(moments.clanMemberId, clanMemberId), eq(moments.dedupKey, clanCopy));
  // clan-scope: global -- keyed by a SEAT, and a seat belongs to exactly one clan
  const hit = await db.select({ id: moments.id }).from(moments).where(where).limit(1);
  return hit.length > 0;
}

/** How long the clan keeps an achievement no board or week holds. */
export const CLAN_ACHIEVEMENT_KEEP_DAYS = 30;
/** Rows one sweep deletes at most; the next tick takes the rest. */
const ACHIEVEMENT_SWEEP_BATCH = 1000;

/**
 * Forget clan-wide achievements and separate-save timeline rows older than
 * {@link CLAN_ACHIEVEMENT_KEEP_DAYS}. Rows a board or competition week holds are theirs, kept with
 * them. Bounded per call; returns how many went.
 */
export async function sweepClanAchievements(now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - CLAN_ACHIEVEMENT_KEEP_DAYS * 86_400_000).toISOString();
  // clan-scope: global -- platform retention sweep across every clan's clan-wide rows
  const gone = await db
    .delete(moments)
    .where(
      inArray(
        moments.id,
        db
          .select({ id: moments.id })
          .from(moments)
          .where(
            and(
              isNull(moments.eventId),
              isNull(moments.weeklyCompetitionId),
              or(inArray(moments.kind, [...ACHIEVEMENT_KINDS, MILESTONE_KIND]), isNotNull(moments.worldMode)),
              lt(moments.occurredAt, cutoff),
            ),
          )
          .orderBy(moments.occurredAt)
          .limit(ACHIEVEMENT_SWEEP_BATCH),
      ),
    )
    .returning({ id: moments.id });
  return gone.length;
}

/** A moment just stored, as the live panel rows want it (lib/panelRows). */
export interface StoredMoment {
  id: number;
  rsn: string;
  kind: string;
  itemId: number | null;
  itemName: string | null;
  quantity: number;
  valueGp: number | null;
  source: string | null;
  /** 'level': skill / total / max. 'quest': 'cape' on the last one. */
  sourceKind: string | null;
  teamId: number | null;
  eventId: number | null;
  tier: string | null;
  worldMode: string | null;
  worldModeLabel: string | null;
  kc: number | null;
  occurredAt: string;
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
  worldMode: moments.worldMode,
  worldModeLabel: moments.worldModeLabel,
  sourceKind: moments.sourceKind,
  teamId: moments.teamId,
  eventId: moments.eventId,
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
  /** Separate-save mode, null for ordinary main-game activity. */
  worldMode?: string | null;
  worldModeLabel?: string | null;
  /** 'level' reads this to tell a 99 from a total-level milestone from a max. */
  sourceKind: string | null;
  /** Which side it happened on, stamped at ingest. Null on weekly/solo moments. */
  teamId: number | null;
  /** The board it was filed on, if any (a hidden-standings board keeps it out of the clan feed). */
  eventId?: number | null;
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

/**
 * A board's feed, newest first, as the board shows it (lib/moments isEventFeedWorthy). Reads a
 * window several times the asked-for size, like the clan feed, so a burst of filtered-out rune
 * stacks can't empty it.
 */
export async function eventFeed(eventId: number, limit = 12): Promise<MomentRow[]> {
  const rows = await momentsForEvent(eventId, Math.min(limit * 12, 600));
  return rows.filter(isEventFeedWorthy).slice(0, limit);
}

/** A board's moments, newest first — everything stored. */
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
/**
 * The clan's newest moments. `kinds` narrows it IN THE QUERY: a Pets or Deaths view reaches back
 * through the whole history, where filtering the newest few hundred of every kind afterwards showed
 * only the pets that happened to fall inside the last couple of days of drops.
 */
export async function momentsForClan(clanId: number, limit = 20, kinds?: readonly string[]): Promise<MomentRow[]> {
  const clan = await clanScope(clanId);
  const window = Math.min(limit * 12, 600);
  const rows = await db
    .select(MOMENT_COLUMNS)
    .from(moments)
    .innerJoin(clanMemberships, eq(moments.clanMemberId, clanMemberships.id))
    // Members only. A guest seat is somebody visiting for a board (the other side of a clan-v-clan),
    // and their drops are that board's story, not this clan's — the event feed still shows them.
    .where(
      and(
        eq(clanMemberships.clanId, clanId),
        eq(clanMemberships.kind, 'member'),
        kinds?.includes('death')
          ? or(isNull(moments.worldMode), and(eq(moments.worldMode, 'hardcore'), eq(moments.kind, 'death')))
          : isNull(moments.worldMode),
        kinds && kinds.length ? inArray(moments.kind, [...kinds]) : undefined,
      ),
    )
    .orderBy(desc(moments.occurredAt))
    .limit(window);
  return rows.filter((row) => isClanWorthy(row, clan)).slice(0, limit);
}

/** Separate-save activity for the compact Modes timeline, never mixed into the ordinary clan feed. */
export async function modeMomentsForClan(clanId: number, limit = 80, kinds?: readonly string[], worldMode?: string | null): Promise<MomentRow[]> {
  return db
    .select(MOMENT_COLUMNS)
    .from(moments)
    .innerJoin(clanMemberships, eq(moments.clanMemberId, clanMemberships.id))
    .where(and(
      eq(clanMemberships.clanId, clanId),
      eq(clanMemberships.kind, 'member'),
      isNotNull(moments.worldMode),
      kinds && kinds.length ? inArray(moments.kind, [...kinds]) : undefined,
      worldMode ? eq(moments.worldMode, worldMode) : undefined,
    ))
    .orderBy(desc(moments.occurredAt))
    .limit(limit);
}

/** Modes that have actually appeared in this clan's timeline, for the plugin's compact selector. */
export async function modeMomentModesForClan(clanId: number): Promise<{ key: string; label: string }[]> {
  const rows = await db
    .selectDistinct({ key: moments.worldMode, label: moments.worldModeLabel })
    .from(moments)
    .innerJoin(clanMemberships, eq(moments.clanMemberId, clanMemberships.id))
    .where(and(
      eq(clanMemberships.clanId, clanId),
      eq(clanMemberships.kind, 'member'),
      isNotNull(moments.worldMode),
    ))
    .orderBy(asc(moments.worldModeLabel), asc(moments.worldMode));
  const out = new Map<string, string>();
  for (const row of rows) {
    const key = row.key?.trim();
    if (key && !out.has(key)) out.set(key, row.label?.trim() || key);
  }
  return [...out].map(([key, label]) => ({ key, label }));
}

/** Number shown on the quiet doorway. Old seasons do not keep the doorway permanently visible. */
export async function recentModeMomentCount(clanId: number, now = Date.now()): Promise<number> {
  const cutoff = new Date(now - 30 * 86_400_000).toISOString();
  const [row] = await db
    .select({ n: count() })
    .from(moments)
    .innerJoin(clanMemberships, eq(moments.clanMemberId, clanMemberships.id))
    .where(and(
      eq(clanMemberships.clanId, clanId),
      eq(clanMemberships.kind, 'member'),
      isNotNull(moments.worldMode),
      gte(moments.occurredAt, cutoff),
    ));
  return Number(row?.n ?? 0);
}

export async function momentsForMembers(clanMemberIds: number[], limit = 20): Promise<MomentRow[]> {
  if (clanMemberIds.length === 0) return [];
  return db
    .select(MOMENT_COLUMNS)
    .from(moments)
    .where(and(inArray(moments.clanMemberId, clanMemberIds), isNull(moments.worldMode)))
    .orderBy(desc(moments.occurredAt))
    .limit(limit);
}
