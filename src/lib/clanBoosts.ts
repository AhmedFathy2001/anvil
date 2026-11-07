// Clan boosts: the reads and writes (the rules are lib/clanBoostRules, the routes api/profile/boosts
// and api/admin/clan/boosts).
//
// WHAT COUNTS is decided on every read, never stored: a boost counts while its person pays for a tier
// with a slot for it (oldest first), its seat is still a live member seat of that clan held by that
// person's character, and the person has no more than two counted there. So a lapse, a downgrade, a
// seat that left the roster or an ownership change all take effect on the next read with nothing
// to sweep. Only the LEVEL is stored (clan_boost_state), because a drop keeps the old level's perks
// for a grace week and that needs to remember when it dropped.
//
// TENANT RULE: a clan is only ever shown its own boosters, as the seat's character. Reads across clans
// (the Clan Hall, a person's own boosts) say so with a clan-scope comment.

import { and, desc, eq, inArray, isNull, sql, type SQL } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, clanAuditLog, clanBoosts, clanBoostState, clanMemberships, clans, supporterSubscriptions, users } from '@/db/schema';
import { isDiscordWebhookTarget } from '@/lib/discordWebhookUrl';
import { log } from '@/lib/logger';
import { getPlatformSetting, isPreview, setPlatformSetting } from '@/lib/platformSettings';
import { apexOrigin } from '@/lib/seo';
import {
  activeBoostIds,
  boostPerks,
  boostersWall,
  cleanRecruitPost,
  cleanRecruitingLine,
  clanBoostNameStyle,
  validateClanBoostNameStyle,
  countedRows,
  effectiveBoostLevel,
  levelProgress,
  levelUpFrom,
  movableAt,
  onePerClan,
  slotTier,
  pickSlot,
  recruitPostAllowed,
  seatHeldSince,
  seatVerdict,
  seatVerdictText,
  slotsFor,
  stampMs,
  wallForViewer,
  type BoostBadge,
  type BoostLevel,
  type ClanBoostNameStyle,
  type LevelState,
  type SeatVerdict,
  type WallEntry,
  type WallRow,
} from '@/lib/clanBoostRules';
import type { SupporterTierId } from '@/lib/supporterTiers';

export * from '@/lib/clanBoostRules';

/**
 * Platform setting: the Anvil Discord channel webhook that Level 3 clans' monthly recruitment posts go
 * to (set on /staff/discord, beside the new-supporters one).
 */
export const ANVIL_RECRUITMENT_WEBHOOK_KEY = 'anvil_discord_recruitment_webhook';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Exec = typeof db | Tx;

const nowIso = () => new Date().toISOString();

// =============================================================================
// Reading live boosts
// =============================================================================

interface LiveBoost extends WallRow {
  slot: number;
  accountId: number;
  clanName: string;
  clanSlug: string;
}

/** Live (not ended) boost rows matching `where`, each with whether its seat still carries it. */
async function liveBoosts(ex: Exec, where: SQL | undefined): Promise<LiveBoost[]> {
  // clan-scope: global -- callers narrow by clan or by person in `where`; boosts span clans by design.
  const rows = await ex
    .select({
      id: clanBoosts.id,
      userId: clanBoosts.userId,
      clanId: clanBoosts.clanId,
      seatId: clanBoosts.clanMemberId,
      slot: clanBoosts.slot,
      placedAt: clanBoosts.placedAt,
      levelUp: clanBoosts.levelUp,
      seatClanId: clanMemberships.clanId,
      seatKind: clanMemberships.kind,
      seatLeftAt: clanMemberships.leftAt,
      accountId: accounts.id,
      accountPlayerId: accounts.playerId,
      userPlayerId: users.playerId,
      rsn: accounts.rsn,
      clanName: clans.name,
      clanSlug: clans.slug,
      clanKind: clans.kind,
      clanStatus: clans.status,
    })
    .from(clanBoosts)
    .innerJoin(clanMemberships, eq(clanMemberships.id, clanBoosts.clanMemberId))
    .innerJoin(accounts, eq(accounts.id, clanMemberships.accountId))
    .innerJoin(users, eq(users.id, clanBoosts.userId))
    .innerJoin(clans, eq(clans.id, clanBoosts.clanId))
    .where(and(isNull(clanBoosts.endedAt), where));
  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    clanId: r.clanId,
    seatId: r.seatId,
    slot: r.slot,
    placedAt: stampMs(r.placedAt),
    levelUp: r.levelUp,
    rsn: r.rsn,
    accountId: r.accountId,
    clanName: r.clanName,
    clanSlug: r.clanSlug,
    // The seat still carries it: a live member seat of THIS clan, its character still this person's,
    // and the clan still an active in-game clan.
    seatLive:
      r.seatClanId === r.clanId &&
      r.seatKind === 'member' &&
      !r.seatLeftAt &&
      r.userPlayerId != null &&
      r.accountPlayerId === r.userPlayerId &&
      r.clanKind === 'clan' &&
      r.clanStatus === 'active',
  }));
}

/** Each person's slot tier (lib/clanBoostRules slotTier: paid, lab, or a gift with slots) and so their slots. */
async function slotTiers(ex: Exec, userIds: number[]): Promise<Map<number, SupporterTierId>> {
  const out = new Map<number, SupporterTierId>();
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return out;
  const rows = await ex
    .select({
      userId: supporterSubscriptions.userId,
      tier: supporterSubscriptions.tier,
      status: supporterSubscriptions.status,
      currentPeriodEnd: supporterSubscriptions.currentPeriodEnd,
      startedAt: supporterSubscriptions.startedAt,
      recurrence: supporterSubscriptions.recurrence,
      grantsBoostSlots: supporterSubscriptions.grantsBoostSlots,
    })
    .from(supporterSubscriptions)
    .where(inArray(supporterSubscriptions.userId, ids));
  const byUser = new Map<number, typeof rows>();
  for (const r of rows) byUser.set(r.userId, [...(byUser.get(r.userId) ?? []), r]);
  for (const [id, list] of byUser) {
    const t = slotTier(list);
    if (t) out.set(id, t);
  }
  return out;
}

/** The person's paid tier (null when not paying) and slots. */
export async function boostSlotsFor(userId: number): Promise<{ tier: SupporterTierId | null; slots: number }> {
  const tier = (await slotTiers(db, [userId])).get(userId) ?? null;
  return { tier, slots: slotsFor(tier) };
}

/**
 * The active boosts (counting toward a level) among the live boosts of the clans in `clanIds`, or of
 * every clan. A person's slots are one pool across clans, so which of their boosts are active needs
 * ALL of their live rows, not just this clan's: the second query reads them.
 */
async function activeBoosts(ex: Exec, clanIds: number[] | 'all'): Promise<LiveBoost[]> {
  if (clanIds !== 'all' && clanIds.length === 0) return [];
  const here = await liveBoosts(ex, clanIds === 'all' ? undefined : inArray(clanBoosts.clanId, clanIds));
  if (here.length === 0) return [];
  const people = [...new Set(here.map((r) => r.userId))];
  const theirs = clanIds === 'all' ? here : await liveBoosts(ex, inArray(clanBoosts.userId, people));
  const tiers = await slotTiers(ex, people);
  const slots = new Map(people.map((u) => [u, slotsFor(tiers.get(u) ?? null)]));
  const active = activeBoostIds(theirs, slots);
  const want = clanIds === 'all' ? null : new Set(clanIds);
  return theirs.filter((r) => active.has(r.id) && (!want || want.has(r.clanId)));
}

async function countedFor(ex: Exec, clanId: number): Promise<number> {
  return countedRows(await activeBoosts(ex, [clanId])).length;
}

// =============================================================================
// Levels
// =============================================================================

export interface ClanBoostLevel extends LevelState {
  clanId: number;
  /** Effective count used for perks/progress: organic plus the platform's current gap filler. */
  counted: number;
  organicCounted: number;
  platformCount: number;
  giftTargetLevel: BoostLevel;
  nameStyle: ClanBoostNameStyle | null;
}

/**
 * Each clan's boost level as it applies now, reconciled with what is stored (the grace week) and
 * written back where it moved. `clanIds` 'all' for the Clan Hall. A clan with no boosts and nothing
 * stored is simply absent (level 0).
 */
export async function clanBoostLevels(clanIds: number[] | 'all', now = Date.now()): Promise<Map<number, ClanBoostLevel>> {
  return (await reconcileLevels(clanIds, now)).levels;
}

async function reconcileLevels(clanIds: number[] | 'all', now: number): Promise<{ levels: Map<number, ClanBoostLevel>; written: number }> {
  const out = new Map<number, ClanBoostLevel>();
  if (clanIds !== 'all' && clanIds.length === 0) return { levels: out, written: 0 };
  const [active, stored] = await Promise.all([
    activeBoosts(db, clanIds),
    // clan-scope: global -- the stored levels of exactly the clans asked about (or all, for the Clan Hall).
    db
      .select({ clanId: clanBoostState.clanId, level: clanBoostState.level, droppedAt: clanBoostState.droppedAt, giftLevel: clanBoostState.giftLevel, giftExpiresAt: clanBoostState.giftExpiresAt, nameStyle: clanBoostState.nameStyle })
      .from(clanBoostState)
      .where(clanIds === 'all' ? sql`${clanBoostState.level} > 0 or ${clanBoostState.giftLevel} > 0` : inArray(clanBoostState.clanId, clanIds)),
  ]);
  const counted = new Map<number, number>();
  for (const r of countedRows(active)) counted.set(r.clanId, (counted.get(r.clanId) ?? 0) + 1);
  const storedBy = new Map(stored.map((s) => [s.clanId, s]));
  const ids = new Set<number>([...counted.keys(), ...storedBy.keys()]);
  const writes: Promise<unknown>[] = [];
  for (const clanId of ids) {
    const s = storedBy.get(clanId);
    const n = counted.get(clanId) ?? 0;
    const eff = effectiveBoostLevel(
      s ? { level: s.level, droppedAt: s.droppedAt ? stampMs(s.droppedAt) : null } : null,
      n,
      s ? { level: s.giftLevel, expiresAt: s.giftExpiresAt } : null,
      now,
    );
    const { organic, ...level } = eff;
    if (organic.changed) writes.push(writeLevel(clanId, organic));
    if (level.level > 0 || level.counted > 0) out.set(clanId, {
      ...level,
      clanId,
      nameStyle: clanBoostNameStyle(s?.nameStyle),
    });
  }
  // A failed write only means the next read reconciles again; the answer above is still right.
  await Promise.all(writes.map((w) => w.catch((err) => log.warn('clan-boosts.level-write-failed', {}, err))));
  return { levels: out, written: writes.length };
}

// =============================================================================
// The hourly reconcile (lib/eventLifecycle's every-minute tick)
// =============================================================================

const RECONCILE_AT_KEY = 'clan_boosts_reconciled_at';
const RECONCILE_CURSOR_KEY = 'clan_boosts_reconcile_cursor';
export const RECONCILE_EVERY_MS = 60 * 60 * 1000;
/** Clans per tick: a run that needs more carries on from a cursor on the next tick (a minute later). */
export const RECONCILE_BATCH = 500;

/**
 * Record every clan's boost level on time, so a drop starts its grace week within the hour it
 * happened rather than whenever a page next looks (a lapse, a term running out, a seat leaving the
 * roster: none of those touch a boost row). Hourly, in clan-id batches, idempotent: reconcileLevel
 * writes only what moved, and running twice changes nothing. The read path still reconciles too, as
 * the fallback. Returns the rows written, or -1 when it isn't due.
 */
export async function reconcileClanBoostLevels(now = Date.now()): Promise<number> {
  const cursorRaw = await getPlatformSetting(RECONCILE_CURSOR_KEY);
  if (cursorRaw == null) {
    const last = Number(await getPlatformSetting(RECONCILE_AT_KEY));
    if (Number.isFinite(last) && now - last < RECONCILE_EVERY_MS) return -1;
  }
  const cursor = Number(cursorRaw) || 0;
  // clan-scope: global -- the sweep visits every clan with a live boost or a stored level, by design.
  const [live, stored] = await Promise.all([
    db.selectDistinct({ clanId: clanBoosts.clanId }).from(clanBoosts).where(and(isNull(clanBoosts.endedAt), sql`${clanBoosts.clanId} > ${cursor}`)),
    db.select({ clanId: clanBoostState.clanId }).from(clanBoostState).where(and(sql`(${clanBoostState.level} > 0 or ${clanBoostState.giftLevel} > 0)`, sql`${clanBoostState.clanId} > ${cursor}`)),
  ]);
  const ids = [...new Set([...live, ...stored].map((r) => r.clanId))].sort((a, b) => a - b);
  const batch = ids.slice(0, RECONCILE_BATCH);
  const { written } = await reconcileLevels(batch, now);
  if (ids.length > RECONCILE_BATCH) {
    await setPlatformSetting(RECONCILE_CURSOR_KEY, String(batch[batch.length - 1]));
  } else {
    await setPlatformSetting(RECONCILE_CURSOR_KEY, null);
    await setPlatformSetting(RECONCILE_AT_KEY, String(now));
  }
  return written;
}

function writeLevel(clanId: number, state: LevelState) {
  const values = { level: state.level, droppedAt: state.droppedAt ? new Date(state.droppedAt).toISOString() : null, updatedAt: nowIso() };
  // clan-scope: this clan's own state row.
  return db.insert(clanBoostState).values({ clanId, ...values }).onConflictDoUpdate({ target: clanBoostState.clanId, set: values });
}

export async function clanBoostLevel(clanId: number): Promise<ClanBoostLevel> {
  return (await clanBoostLevels([clanId])).get(clanId) ?? emptyLevel(clanId);
}

function emptyLevel(clanId: number): ClanBoostLevel {
  return { clanId, counted: 0, organicCounted: 0, platformCount: 0, giftTargetLevel: 0, nameStyle: null, level: 0, countedLevel: 0, droppedAt: null, graceEndsAt: null, changed: false };
}

/** What the Clan Hall needs per clan: the level in force and (Level 2+) the recruiting line. */
export interface ClanBoostDisplay {
  level: BoostLevel;
  recruitingLine: string | null;
  nameStyle: ClanBoostNameStyle | null;
}

export async function clanBoostDisplays(clanIds: number[] | 'all'): Promise<Map<number, ClanBoostDisplay>> {
  const levels = await clanBoostLevels(clanIds);
  const out = new Map<number, ClanBoostDisplay>();
  if (levels.size === 0) return out;
  const ids = [...levels.keys()];
  // clan-scope: global -- the recruiting lines of the boosted clans just read.
  const lines = await db
    .select({ clanId: clanBoostState.clanId, line: clanBoostState.recruitingLine, nameStyle: clanBoostState.nameStyle })
    .from(clanBoostState)
    .where(inArray(clanBoostState.clanId, ids));
  const lineBy = new Map(lines.map((l) => [l.clanId, l.line]));
  const styleBy = new Map(lines.map((l) => [l.clanId, clanBoostNameStyle(l.nameStyle)]));
  for (const [id, l] of levels) {
    if (l.level <= 0) continue;
    out.set(id, { level: l.level, recruitingLine: boostPerks(l.level).recruitingLine ? lineBy.get(id)?.trim() || null : null, nameStyle: styleBy.get(id) ?? null });
  }
  return out;
}

// =============================================================================
// One clan: its level, progress, wall and booster marks
// =============================================================================

export interface ClanBoostSummary {
  level: BoostLevel;
  counted: number;
  organicCounted: number;
  platformCount: number;
  giftTargetLevel: BoostLevel;
  nameStyle: ClanBoostNameStyle | null;
  countedLevel: BoostLevel;
  graceEndsAt: number | null;
  progress: { next: 1 | 2 | 3; need: number; have: number } | null;
  recruitingLine: string | null;
  /** The raw stored line, for the editor (shown to visitors only at Level 2+). */
  recruitingLineDraft: string | null;
  lastRecruitPostAt: number | null;
  /** This month's recruitment post is used: when the next one opens (ms). */
  recruitPostNextAt: number | null;
  wall: WallEntry[];
  /** False when the wall's names were stripped for this viewer (wallForViewer). */
  names: boolean;
}

/** Whoever placed this clan's first boost ever, ended ones included. */
async function firstBoosterOf(clanId: number): Promise<number | null> {
  // clan-scope: this clan's boosts.
  const [row] = await db
    .select({ userId: clanBoosts.userId })
    .from(clanBoosts)
    .where(eq(clanBoosts.clanId, clanId))
    .orderBy(clanBoosts.placedAt, clanBoosts.id)
    .limit(1);
  return row?.userId ?? null;
}

/**
 * One clan's boost summary. `showNames` false for a viewer outside the clan when the clan keeps its
 * members' names from strangers (lib/clanHall hallConfig publicNames): the wall then carries no
 * names or seat ids at all (wallForViewer).
 */
export async function clanBoostSummary(clanId: number, opts: { showNames?: boolean } = {}): Promise<ClanBoostSummary> {
  const showNames = opts.showNames ?? true;
  const [level, active, first, state] = await Promise.all([
    clanBoostLevel(clanId),
    activeBoosts(db, [clanId]),
    firstBoosterOf(clanId),
    // clan-scope: this clan's own state row.
    db.query.clanBoostState.findFirst({ where: eq(clanBoostState.clanId, clanId) }),
  ]);
  const perks = boostPerks(level.level);
  return {
    level: level.level,
    counted: level.counted,
    organicCounted: level.organicCounted,
    platformCount: level.platformCount,
    giftTargetLevel: level.giftTargetLevel,
    nameStyle: level.nameStyle,
    countedLevel: level.countedLevel,
    graceEndsAt: level.graceEndsAt,
    progress: levelProgress(level.counted),
    recruitingLine: perks.recruitingLine ? state?.recruitingLine?.trim() || null : null,
    recruitingLineDraft: state?.recruitingLine ?? null,
    lastRecruitPostAt: state?.lastRecruitPostAt ? stampMs(state.lastRecruitPostAt) : null,
    recruitPostNextAt: (() => {
      const r = recruitPostAllowed(state?.lastRecruitPostAt ? stampMs(state.lastRecruitPostAt) : null, Date.now());
      return r.ok ? null : r.nextAt;
    })(),
    wall: wallForViewer(boostersWall(active, first, Date.now()), showNames),
    names: showNames,
  };
}

/**
 * The Booster mark: this clan's boosting characters by name (as the roster spells them), with how
 * many counted boosts ride on each. Flair is decoration, so a failed read is no marks.
 */
export async function boosterMarks(clanId: number): Promise<Record<string, number>> {
  try {
    const out: Record<string, number> = {};
    for (const r of countedRows(await activeBoosts(db, [clanId]))) out[r.rsn] = (out[r.rsn] ?? 0) + 1;
    return out;
  } catch (err) {
    log.warn('clan-boosts.marks-failed', { clanId }, err);
    return {};
  }
}

/**
 * The clans where this character's seat carries a counted boost (its Discord posts there get the
 * booster icon). Its other clans see the ordinary Supporter star.
 */
export async function boostedClanIdsForAccount(accountId: number): Promise<Set<number>> {
  // clan-scope: global -- one character's boosts, whichever clans they sit in (it has one member seat).
  const here = await liveBoosts(db, eq(clanMemberships.accountId, accountId));
  if (here.length === 0) return new Set();
  const clanIds = [...new Set(here.map((r) => r.clanId))];
  const counted = countedRows(await activeBoosts(db, clanIds));
  return new Set(counted.filter((r) => r.accountId === accountId).map((r) => r.clanId));
}

// =============================================================================
// One person: their slots, placements and the clans they could boost
// =============================================================================

export type PlacementState = 'active' | 'paused' | 'seat-gone';

export interface MyPlacement {
  id: number;
  slot: number;
  /** The seat it rides on (one of their own). */
  seatId: number;
  clanId: number;
  clanName: string;
  clanSlug: string;
  rsn: string;
  since: number;
  state: PlacementState;
  /** When it may move (0 = now). */
  movableAt: number;
  /** Counts toward the clan's level (not over the two-per-person cap). */
  counted: boolean;
  badges: BoostBadge[];
}

/** One clan the person could boost (or can't yet), with the seat a boost there would ride on. */
export interface BoostCandidate {
  seatId: number;
  clanId: number;
  clanName: string;
  clanSlug: string;
  rsn: string;
  /** The seat's character is the person's main. */
  isMain: boolean;
  heldSince: number;
  verdict: SeatVerdict;
  /** The plain sentence when it can't take a boost yet. */
  why: string | null;
  /** How many of their boosts sit on this clan already. */
  mine: number;
}

export interface MyBoosts {
  /** The instant this was read (ms), so a page compares dates against one clock. */
  now: number;
  tier: SupporterTierId | null;
  slots: number;
  /** Live rows (active, paused or with their seat gone): each holds a slot. */
  used: number;
  free: number;
  /** A free slot still cooling after a removal: when it opens. */
  coolingUntil: number | null;
  placements: MyPlacement[];
  /** One per clan (boosts are the person's): the seat picked automatically, see onePerClan. */
  candidates: BoostCandidate[];
}

/** The person's most recent ended row per slot (for the cooldown) and their live rows. */
async function slotRows(ex: Exec, userId: number) {
  const rows = await ex
    .select({ slot: clanBoosts.slot, endedAt: clanBoosts.endedAt, reusableAt: clanBoosts.reusableAt })
    .from(clanBoosts)
    .where(eq(clanBoosts.userId, userId))
    .orderBy(desc(clanBoosts.id));
  return rows.map((r) => ({ slot: r.slot, ended: !!r.endedAt, reusableAt: r.reusableAt ? stampMs(r.reusableAt) : NaN }));
}

/** Every live member and guest seat of the person's characters in an active in-game clan. */
async function personSeats(playerId: number) {
  // clan-scope: global -- the person's own seats, across every clan they're in.
  return db
    .select({
      seatId: clanMemberships.id,
      clanId: clanMemberships.clanId,
      kind: clanMemberships.kind,
      leftAt: clanMemberships.leftAt,
      joinedAt: clanMemberships.joinedAt,
      ingameJoinedOn: clanMemberships.ingameJoinedOn,
      rsn: accounts.rsn,
      isPrimary: accounts.isPrimary,
      clanName: clans.name,
      clanSlug: clans.slug,
    })
    .from(clanMemberships)
    .innerJoin(accounts, eq(accounts.id, clanMemberships.accountId))
    .innerJoin(clans, eq(clans.id, clanMemberships.clanId))
    .where(
      and(
        eq(accounts.playerId, playerId),
        isNull(clanMemberships.leftAt),
        inArray(clanMemberships.kind, ['member', 'guest']),
        eq(clans.kind, 'clan'),
        eq(clans.status, 'active'),
      ),
    );
}

export async function myBoosts(userId: number, playerId: number | null): Promise<MyBoosts> {
  const now = Date.now();
  const [{ tier, slots }, mine, seats, slotHistory] = await Promise.all([
    boostSlotsFor(userId),
    liveBoosts(db, eq(clanBoosts.userId, userId)),
    playerId ? personSeats(playerId) : Promise.resolve([]),
    slotRows(db, userId),
  ]);
  const clanIds = [...new Set(mine.map((r) => r.clanId))];
  const [active, firsts] = await Promise.all([
    activeBoosts(db, clanIds),
    Promise.all(clanIds.map(async (id) => [id, await firstBoosterOf(id)] as const)),
  ]);
  const activeIds = new Set(active.map((r) => r.id));
  const countedIds = new Set(countedRows(active).map((r) => r.id));
  const firstBy = new Map(firsts);

  // Badges as the clan's wall shows them, for the seats that are this person's.
  const badgesBySeat = new Map<string, BoostBadge[]>();
  for (const clanId of clanIds) {
    const wall = boostersWall(active.filter((r) => r.clanId === clanId), firstBy.get(clanId) ?? null, now);
    for (const e of wall) badgesBySeat.set(`${clanId}:${e.seatId}`, e.badges);
  }

  mine.sort((a, b) => a.placedAt - b.placedAt || a.id - b.id);
  const firstCountedOnSeat = new Map<number, number>();
  for (const r of mine) if (countedIds.has(r.id) && !firstCountedOnSeat.has(r.seatId)) firstCountedOnSeat.set(r.seatId, r.id);
  const placements: MyPlacement[] = mine
    .sort((a, b) => a.placedAt - b.placedAt || a.id - b.id)
    .map((r) => ({
      id: r.id,
      slot: r.slot,
      seatId: r.seatId,
      clanId: r.clanId,
      clanName: r.clanName,
      clanSlug: r.clanSlug,
      rsn: r.rsn,
      since: r.placedAt,
      state: !r.seatLive ? 'seat-gone' : activeIds.has(r.id) ? 'active' : 'paused',
      movableAt: movableAt(r.placedAt, !r.seatLive),
      counted: countedIds.has(r.id),
      // A seat's badges once, on its earliest counted boost (the wall shows them per seat).
      badges: firstCountedOnSeat.get(r.seatId) === r.id ? (badgesBySeat.get(`${r.clanId}:${r.seatId}`) ?? []) : [],
    }));

  const pick = pickSlot(slots, slotHistory, now);
  const used = mine.length;
  const candidates: BoostCandidate[] = onePerClan(
    seats.map((s) => {
      const heldSince = seatHeldSince(s.joinedAt, s.ingameJoinedOn);
      const verdict = seatVerdict({ kind: s.kind, leftAt: s.leftAt, heldSince }, now);
      return {
        seatId: s.seatId,
        clanId: s.clanId,
        clanName: s.clanName,
        clanSlug: s.clanSlug,
        rsn: s.rsn,
        isMain: s.isPrimary === 1,
        heldSince,
        verdict,
        why: seatVerdictText(verdict, s.clanName),
        mine: mine.filter((m) => m.clanId === s.clanId).length,
      };
    }),
  );

  return {
    now,
    tier,
    slots,
    used,
    free: Math.max(0, slots - used),
    coolingUntil: !pick.ok && pick.reason === 'cooling' ? pick.until : null,
    placements,
    candidates,
  };
}

// =============================================================================
// Writes: place, move, remove
// =============================================================================

export type BoostResult = { ok: true; id: number } | { ok: false; status: number; error: string };
const fail = (status: number, error: string): BoostResult => ({ ok: false, status, error });

/** A seat the person may put a boost on, read inside the transaction. */
async function boostableSeat(tx: Tx, seatId: number, playerId: number, now: number) {
  // clan-scope: global -- a seat id the caller named; ownership is checked against the person below.
  const [seat] = await tx
    .select({
      seatId: clanMemberships.id,
      clanId: clanMemberships.clanId,
      kind: clanMemberships.kind,
      leftAt: clanMemberships.leftAt,
      joinedAt: clanMemberships.joinedAt,
      ingameJoinedOn: clanMemberships.ingameJoinedOn,
      playerId: accounts.playerId,
      clanName: clans.name,
      clanKind: clans.kind,
      clanStatus: clans.status,
    })
    .from(clanMemberships)
    .innerJoin(accounts, eq(accounts.id, clanMemberships.accountId))
    .innerJoin(clans, eq(clans.id, clanMemberships.clanId))
    .where(eq(clanMemberships.id, seatId))
    .limit(1);
  // Someone else's seat reads the same as no seat: nothing to learn by guessing ids.
  if (!seat || seat.playerId !== playerId) return { ok: false as const, error: 'That seat isn’t one of yours.' };
  if (seat.clanKind !== 'clan' || seat.clanStatus !== 'active') return { ok: false as const, error: 'Only in-game clans can be boosted.' };
  const verdict = seatVerdict({ kind: seat.kind, leftAt: seat.leftAt, heldSince: seatHeldSince(seat.joinedAt, seat.ingameJoinedOn) }, now);
  if (!verdict.ok) return { ok: false as const, error: seatVerdictText(verdict, seat.clanName) ?? 'That seat can’t take a boost.' };
  return { ok: true as const, seat };
}

/** Serialise one person's boost writes: two tabs placing at once queue here instead of racing. */
async function lockPerson(tx: Tx, userId: number) {
  await tx.execute(sql`select id from users where id = ${userId} for update`);
}

/** Place a free slot's boost on the clan behind `seatId` (one of the person's member seats). */
export async function placeBoost(userId: number, playerId: number, seatId: number): Promise<BoostResult> {
  const now = Date.now();
  let clanId = 0;
  const res = await db.transaction(async (tx): Promise<BoostResult> => {
    await lockPerson(tx, userId);
    const tier = (await slotTiers(tx, [userId])).get(userId) ?? null;
    const slots = slotsFor(tier);
    if (slots === 0) return fail(403, 'Boosts come with a paid Supporter tier.');
    const target = await boostableSeat(tx, seatId, playerId, now);
    if (!target.ok) return fail(400, target.error);
    const pick = pickSlot(slots, await slotRows(tx, userId), now);
    if (!pick.ok) {
      if (pick.reason === 'cooling') return fail(409, `Your free slot opens again on ${dateText(pick.until)}: a boost can move once a week.`);
      return fail(409, 'All your boosts are placed. Move or remove one first.');
    }
    clanId = target.seat.clanId;
    const before = await countedFor(tx, clanId);
    const [row] = await tx
      .insert(clanBoosts)
      .values({ userId, clanId, clanMemberId: seatId, slot: pick.slot, placedAt: new Date(now).toISOString() })
      .returning({ id: clanBoosts.id });
    const lifted = levelUpFrom(before, await countedFor(tx, clanId));
    if (lifted) await tx.update(clanBoosts).set({ levelUp: lifted }).where(eq(clanBoosts.id, row.id));
    return { ok: true, id: row.id };
  }).catch((err: unknown) => uniqueRace(err));
  if (res.ok) await clanBoostLevels([clanId]).catch(() => {});
  return res;
}

/** Move a placed boost to another of the person's seats (another clan, or another character). */
export async function moveBoost(userId: number, playerId: number, boostId: number, seatId: number): Promise<BoostResult> {
  const now = Date.now();
  const touched: number[] = [];
  const res = await db.transaction(async (tx): Promise<BoostResult> => {
    await lockPerson(tx, userId);
    const [current] = await liveBoosts(tx, and(eq(clanBoosts.id, boostId), eq(clanBoosts.userId, userId)));
    if (!current) return fail(404, 'That boost isn’t yours, or has already moved.');
    if (current.seatId === seatId) return fail(400, 'It’s already there.');
    const at = movableAt(current.placedAt, !current.seatLive);
    if (now < at) return fail(409, `This boost can move on ${dateText(at)}: once a week.`);
    const target = await boostableSeat(tx, seatId, playerId, now);
    if (!target.ok) return fail(400, target.error);
    const iso = new Date(now).toISOString();
    await tx.update(clanBoosts).set({ endedAt: iso, endReason: 'moved' }).where(eq(clanBoosts.id, boostId));
    const before = await countedFor(tx, target.seat.clanId);
    const [row] = await tx
      .insert(clanBoosts)
      .values({ userId, clanId: target.seat.clanId, clanMemberId: seatId, slot: current.slot, placedAt: iso })
      .returning({ id: clanBoosts.id });
    const lifted = levelUpFrom(before, await countedFor(tx, target.seat.clanId));
    if (lifted) await tx.update(clanBoosts).set({ levelUp: lifted }).where(eq(clanBoosts.id, row.id));
    touched.push(current.clanId, target.seat.clanId);
    return { ok: true, id: row.id };
  }).catch((err: unknown) => uniqueRace(err));
  if (res.ok) await clanBoostLevels([...new Set(touched)]).catch(() => {});
  return res;
}

/** Take a boost off. Its slot opens again when the boost could have moved (a week from placing). */
export async function removeBoost(userId: number, boostId: number): Promise<BoostResult> {
  let clanId = 0;
  const res = await db.transaction(async (tx): Promise<BoostResult> => {
    await lockPerson(tx, userId);
    const [current] = await liveBoosts(tx, and(eq(clanBoosts.id, boostId), eq(clanBoosts.userId, userId)));
    if (!current) return fail(404, 'That boost isn’t yours, or is already gone.');
    const reuse = movableAt(current.placedAt, !current.seatLive);
    await tx
      .update(clanBoosts)
      .set({ endedAt: nowIso(), endReason: 'removed', reusableAt: reuse > Date.now() ? new Date(reuse).toISOString() : null })
      .where(eq(clanBoosts.id, boostId));
    clanId = current.clanId;
    return { ok: true, id: boostId };
  });
  if (res.ok) await clanBoostLevels([clanId]).catch(() => {});
  return res;
}

/** The live-slot unique index refused a write: a double submit that lost the race. */
function uniqueRace(err: unknown): BoostResult {
  const code = (err as { code?: string; cause?: { code?: string } })?.code ?? (err as { cause?: { code?: string } })?.cause?.code;
  if (code === '23505') return fail(409, 'That slot was just used. Refresh to see your boosts.');
  throw err;
}

function dateText(ms: number): string {
  return new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

// =============================================================================
// Clan staff: the recruiting line (L2) and the monthly Discord post (L3)
// =============================================================================

export type StaffResult = { ok: true; note?: string } | { ok: false; status: number; error: string };

/** Set or reset the boosted clan-name palette. A saved look remains through later downgrades. */
export async function setClanBoostNameStyle(clanId: number, raw: unknown, actorUserId: number | null): Promise<StaffResult> {
  const check = validateClanBoostNameStyle(raw);
  if (!check.ok) return { ok: false, status: 400, error: check.error };
  const style = check.style;
  const level = await clanBoostLevel(clanId);
  if (style && level.level < 1) return { ok: false, status: 403, error: 'Custom clan-name colours need boost Level 1.' };
  const encoded = style ? JSON.stringify(style) : null;
  await db
    .insert(clanBoostState)
    .values({ clanId, nameStyle: encoded, updatedAt: nowIso() })
    .onConflictDoUpdate({ target: clanBoostState.clanId, set: { nameStyle: encoded, updatedAt: nowIso() } });
  await db
    .insert(clanAuditLog)
    .values({ clanId, eventType: 'boost_name_style_set', actorUserId, newValue: JSON.stringify({ style }) })
    .catch(() => {});
  return { ok: true };
}

/** Set or clear the clan's recruiting line. Saving needs Level 2; clearing never does. */
export async function setRecruitingLine(clanId: number, raw: unknown, actorUserId: number | null): Promise<StaffResult> {
  const line = cleanRecruitingLine(raw);
  if (line) {
    const level = await clanBoostLevel(clanId);
    if (!boostPerks(level.level).recruitingLine) return { ok: false, status: 403, error: 'A recruiting line needs boost Level 2.' };
  }
  // clan-scope: this clan's own state row.
  await db
    .insert(clanBoostState)
    .values({ clanId, recruitingLine: line, updatedAt: nowIso() })
    .onConflictDoUpdate({ target: clanBoostState.clanId, set: { recruitingLine: line, updatedAt: nowIso() } });
  // clan-scope: this clan.
  await db
    .insert(clanAuditLog)
    .values({ clanId, eventType: 'boost_recruiting_line_set', actorUserId, newValue: JSON.stringify({ line }) })
    .catch(() => {});
  return { ok: true };
}

/** The Anvil Discord embed for a clan's recruitment post. No person named: it's the clan's post. */
export function recruitPostEmbed(
  clan: { name: string; slug: string; logoUrl: string | null; accent: string | null },
  text: string,
  origin: string,
): Record<string, unknown> {
  const color = clan.accent && /^#[0-9a-f]{6}$/i.test(clan.accent) ? parseInt(clan.accent.slice(1), 16) : 0xf2c14e;
  return {
    title: `${clan.name} is recruiting`.slice(0, 256),
    url: `${origin}/c/${clan.slug}`,
    description: text,
    color,
    ...(clan.logoUrl ? { thumbnail: { url: clan.logoUrl } } : {}),
    footer: { text: 'Boost Level 3 clan · posted by its staff on Anvil' },
  };
}

/**
 * The clan's one recruitment post this calendar month into Anvil's own Discord. Level 3, written by
 * its staff, sent once: the month is claimed in the same statement that checks it, so two submits
 * can't both post, and handed back if Discord refuses. Beta records it but never posts (it shares the
 * real Anvil Discord with production).
 */
export async function sendRecruitPost(clanId: number, raw: unknown, actorUserId: number): Promise<StaffResult> {
  const text = cleanRecruitPost(raw);
  if (!text.ok) return { ok: false, status: 400, error: text.error };
  const level = await clanBoostLevel(clanId);
  if (!boostPerks(level.level).discordPost) return { ok: false, status: 403, error: 'The Discord recruitment post needs boost Level 3.' };
  const hook = await getPlatformSetting(ANVIL_RECRUITMENT_WEBHOOK_KEY);
  const preview = isPreview();
  if (!preview && (!hook || !isDiscordWebhookTarget(hook))) {
    return { ok: false, status: 503, error: 'Anvil’s recruitment channel isn’t set up yet. Try again later.' };
  }
  // clan-scope: this clan's own row.
  const clan = await db.query.clans.findFirst({
    where: eq(clans.id, clanId),
    columns: { name: true, slug: true, logoUrl: true, accentColor: true },
  });
  if (!clan) return { ok: false, status: 404, error: 'No such clan.' };

  const now = Date.now();
  const monthStart = new Date(Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth(), 1)).toISOString();
  // clan-scope: this clan's own state row.
  const [prior] = await db
    .select({ at: clanBoostState.lastRecruitPostAt, by: clanBoostState.lastRecruitPostBy })
    .from(clanBoostState)
    .where(eq(clanBoostState.clanId, clanId));
  const allowed = recruitPostAllowed(prior?.at ? stampMs(prior.at) : null, now);
  if (!allowed.ok) return { ok: false, status: 429, error: `This month’s post is used. The next one opens on ${dateText(allowed.nextAt)}.` };
  // The claim: only a row whose last post is before this month (or that has none) takes it.
  await db.insert(clanBoostState).values({ clanId }).onConflictDoNothing();
  // clan-scope: this clan's own state row.
  const claimed = await db
    .update(clanBoostState)
    .set({ lastRecruitPostAt: new Date(now).toISOString(), lastRecruitPostBy: actorUserId, updatedAt: nowIso() })
    .where(
      and(
        eq(clanBoostState.clanId, clanId),
        sql`(${clanBoostState.lastRecruitPostAt} is null or ${clanBoostState.lastRecruitPostAt} < ${monthStart})`,
      ),
    )
    .returning({ clanId: clanBoostState.clanId });
  if (claimed.length === 0) return { ok: false, status: 429, error: 'This month’s post was just sent.' };

  const audit = () =>
    // clan-scope: this clan.
    db
      .insert(clanAuditLog)
      .values({ clanId, eventType: 'boost_recruit_post_sent', actorUserId, newValue: JSON.stringify({ text: text.text, posted: !preview }) })
      .catch(() => {});

  if (preview) {
    await audit();
    return { ok: true, note: 'Saved. This is beta, so nothing was posted to the Anvil Discord.' };
  }
  const embed = recruitPostEmbed({ name: clan.name, slug: clan.slug, logoUrl: clan.logoUrl, accent: clan.accentColor }, text.text, apexOrigin());
  const res = await fetch(hook!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // Nobody is ever pinged by a clan's text, whatever survived the clean.
    body: JSON.stringify({ embeds: [embed], allowed_mentions: { parse: [] } }),
  }).catch(() => null);
  if (!res?.ok) {
    // Hand the month back: a post Discord refused was never made.
    // clan-scope: this clan's own state row.
    await db
      .update(clanBoostState)
      .set({ lastRecruitPostAt: prior?.at ?? null, lastRecruitPostBy: prior?.by ?? null })
      .where(eq(clanBoostState.clanId, clanId))
      .catch(() => {});
    log.warn('clan-boosts.recruit-post-failed', { clanId, status: res?.status ?? null });
    return { ok: false, status: 502, error: 'Discord didn’t take the post. Nothing was used up; try again in a bit.' };
  }
  await audit();
  return { ok: true };
}

/** For the level's display copy. */
export function levelName(level: number): string {
  return level > 0 ? `Level ${level}` : 'Not boosted';
}

// =============================================================================
// The clan page's viewer line
// =============================================================================

export interface BoostViewer {
  boostSeatId: number | null;
  mine: number;
  note: string | null;
}

/**
 * What the clan page offers this viewer: a Boost button (a paid Supporter with a free slot and a
 * member seat here old enough), or the one sentence that says why not yet. Null for anyone without
 * slots and without a boost here, so a non-supporter is never pitched.
 */
export async function boostViewerFor(clanId: number, userId: number, playerId: number | null): Promise<BoostViewer | null> {
  const mine = await myBoosts(userId, playerId);
  const mineHere = mine.placements.filter((p) => p.clanId === clanId).length;
  if (mine.slots === 0) {
    return mineHere > 0 ? { boostSeatId: null, mine: mineHere, note: 'Your boosts here are paused until your Supporter membership is back.' } : null;
  }
  const here = mine.candidates.filter((c) => c.clanId === clanId);
  const eligible = here.find((c) => c.verdict.ok);
  if (!eligible) {
    const why = here.find((c) => c.verdict.ok === false && c.verdict.reason === 'too-new')?.why ?? null;
    return mineHere > 0 || why ? { boostSeatId: null, mine: mineHere, note: why } : null;
  }
  if (mine.free <= 0) return { boostSeatId: null, mine: mineHere, note: mineHere > 0 ? null : 'All your boosts are placed. You can move one here.' };
  if (mine.coolingUntil) return { boostSeatId: null, mine: mineHere, note: `Your free boost opens again on ${dateText(mine.coolingUntil)}.` };
  return { boostSeatId: eligible.seatId, mine: mineHere, note: null };
}

