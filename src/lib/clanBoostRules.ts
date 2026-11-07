// Clan boosts, pure (lib/clanBoosts does the reads and writes; tests/clan-boost-rules.test.ts).
//
// A Supporter has boost slots while they PAY (earned referral time and staff gifts don't count) and
// places each by hand on a clan where one of their characters holds a live MEMBER seat at least
// SEAT_MIN_DAYS old. Boosts buy VISIBILITY — a badge, a higher place in the Clan Hall, a featured
// spot, a coloured name — never a rank, a score, a seat or a plan feature.
//
// Slots belong to the person (users.id), not the character: three alts in three clans is still one
// pool. A clan's level counts at most PER_PERSON_CAP boosts from any one person, so a level means
// several members chose it. On a downgrade or a lapse the oldest placements stay active and the rest
// pause (kept, not deleted) until the slots come back. A boost whose seat is gone stops counting.
//
// The clan sees the seat's CHARACTER, never the person or their other characters: everything a clan
// is shown (the wall, the booster mark) is keyed by seat.

import { GIFT_RECURRENCE, supporterState, wholeMonths, type SupporterRowLike, type SupporterTierId } from './supporterTiers.ts';

// Champion and Patron only (Ahmed, 2026-11-05): the entry tier is status and hosting, boosts start one up.
export const BOOST_SLOTS: Record<SupporterTierId, number> = { supporter: 0, champion: 1, patron: 2 };
/** The most slots anyone can have (Patron); slot numbers run 1..MAX_SLOTS. */
export const MAX_SLOTS = 2;
export const PER_PERSON_CAP = 2;
/** Counted boosts needed for levels 1, 2 and 3. */
export const LEVEL_AT = [3, 8, 15] as const;
export const SEAT_MIN_DAYS = 14;
export const MOVE_COOLDOWN_DAYS = 7;
/** A clan that drops below a level keeps its perks this long. */
export const GRACE_DAYS = 7;
/** Tenure badges: months of continuous boosting. */
export const TENURE_MONTHS = [1, 3, 6, 12] as const;
export const RECRUITING_LINE_MAX = 140;
export const RECRUIT_POST_MAX = 500;
export const RECRUIT_POST_MIN = 20;

export const DAY_MS = 86_400_000;

export type BoostLevel = 0 | 1 | 2 | 3;

// =============================================================================
// Slots
// =============================================================================

export function slotsFor(paid: SupporterTierId | null | undefined): number {
  return paid ? BOOST_SLOTS[paid] : 0;
}

export interface SlotRowLike extends SupporterRowLike {
  /** A staff gift that also gives boost slots (supporter_subscriptions.grants_boost_slots). */
  grantsBoostSlots?: boolean | null;
}

/** Does this membership row give boost slots: paid (and lab) rows always, staff gifts when they say so, invite time never. */
export function rowGivesSlots(r: SlotRowLike): boolean {
  if (r.status !== 'granted') return true;
  return r.recurrence === GIFT_RECURRENCE && r.grantsBoostSlots === true;
}

/**
 * The tier whose boost slots a person has right now, or null. Rows Anvil handed out don't count —
 * invite rewards never, staff gifts only when staff ticked "with boost slots" — so a paying Supporter
 * given a month of Champion through an invite still has one slot, and someone on invite time alone
 * has none. The best tier among the rows that DO count wins.
 */
export function slotTier(rows: SlotRowLike[], now = Date.now()): SupporterTierId | null {
  return supporterState(rows.filter(rowGivesSlots), now)?.tier.id ?? null;
}

// =============================================================================
// Seats
// =============================================================================

/** Parse either stored timestamp shape ('YYYY-MM-DD HH:MM:SS', 'YYYY-MM-DD' or ISO) as UTC. */
export function stampMs(stamp: string | null | undefined): number {
  if (!stamp) return NaN;
  if (/^\d{4}-\d{2}-\d{2}$/.test(stamp)) return Date.parse(`${stamp}T00:00:00Z`);
  return Date.parse(stamp.includes('T') ? stamp : `${stamp.replace(' ', 'T')}Z`);
}

/**
 * How long a seat has been held: the earlier of when Anvil first saw it and when the game says the
 * character joined (a clan that moved to Anvil last week doesn't make its veterans wait two weeks).
 */
export function seatHeldSince(joinedAt: string | null | undefined, ingameJoinedOn: string | null | undefined): number {
  const times = [stampMs(joinedAt), stampMs(ingameJoinedOn)].filter((t) => Number.isFinite(t));
  return times.length ? Math.min(...times) : NaN;
}

export interface SeatLike {
  kind: string;
  leftAt: string | null;
  heldSince: number;
}

export type SeatVerdict =
  | { ok: true }
  | { ok: false; reason: 'not-member' }
  | { ok: false; reason: 'left' }
  | { ok: false; reason: 'too-new'; boostableAt: number; daysLeft: number; daysHeld: number };

/** May this seat carry a boost: a live member seat held at least SEAT_MIN_DAYS. */
export function seatVerdict(seat: SeatLike, now: number): SeatVerdict {
  if (seat.leftAt) return { ok: false, reason: 'left' };
  if (seat.kind !== 'member') return { ok: false, reason: 'not-member' };
  if (!Number.isFinite(seat.heldSince)) return { ok: false, reason: 'too-new', boostableAt: now + SEAT_MIN_DAYS * DAY_MS, daysLeft: SEAT_MIN_DAYS, daysHeld: 0 };
  const boostableAt = seat.heldSince + SEAT_MIN_DAYS * DAY_MS;
  if (now >= boostableAt) return { ok: true };
  return {
    ok: false,
    reason: 'too-new',
    boostableAt,
    daysLeft: Math.max(1, Math.ceil((boostableAt - now) / DAY_MS)),
    daysHeld: Math.max(0, Math.floor((now - seat.heldSince) / DAY_MS)),
  };
}

export function seatEligible(seat: SeatLike, now: number): boolean {
  return seatVerdict(seat, now).ok;
}

/** The plain sentence for a seat that can't take a boost (Settings → Boosts). */
export function seatVerdictText(v: SeatVerdict, clanName: string): string | null {
  if (v.ok) return null;
  if (v.reason === 'left') return `You're no longer on ${clanName}'s roster.`;
  if (v.reason === 'not-member') return `Your seat in ${clanName} is a guest seat. Boosts ride on member seats from the in-game clan.`;
  const held = v.daysHeld === 1 ? '1 day' : `${v.daysHeld} days`;
  const left = v.daysLeft === 1 ? '1 day' : `${v.daysLeft} days`;
  return `Your seat in ${clanName} is ${held} old; boostable in ${left}.`;
}

// =============================================================================
// Moving and slot reuse
// =============================================================================

/** When a placed boost may move: a week after placing, or at once when its seat is gone. */
export function movableAt(placedAt: number, seatGone: boolean): number {
  return seatGone ? 0 : placedAt + MOVE_COOLDOWN_DAYS * DAY_MS;
}

/**
 * When a REMOVED boost's slot may take a new one: the same week as a move, so remove-then-place
 * can't skip the cooldown. A boost whose seat was already gone frees its slot at once.
 */
export function reusableAt(placedAt: number, seatGone: boolean): number {
  return movableAt(placedAt, seatGone);
}

export interface SlotRow {
  slot: number;
  /** Ended rows only: when the slot may be used again (ms; 0 or NaN = at once). */
  reusableAt: number;
  ended: boolean;
}

export type SlotPick = { ok: true; slot: number } | { ok: false; reason: 'no-slots' | 'full' } | { ok: false; reason: 'cooling'; until: number };

/**
 * Which slot a new placement takes. Needs fewer live rows than slots (a paused boost still holds its
 * slot: remove it to free one), then the lowest-numbered slot that is neither live nor cooling.
 * `rows` is every row of the person's: live, and their most recent ended row per slot.
 */
export function pickSlot(slots: number, rows: SlotRow[], now: number): SlotPick {
  if (slots <= 0) return { ok: false, reason: 'no-slots' };
  const live = rows.filter((r) => !r.ended);
  if (live.length >= slots) return { ok: false, reason: 'full' };
  const taken = new Set(live.map((r) => r.slot));
  let soonest = Infinity;
  for (let s = 1; s <= Math.min(slots, MAX_SLOTS); s++) {
    if (taken.has(s)) continue;
    const cooling = rows
      .filter((r) => r.ended && r.slot === s && Number.isFinite(r.reusableAt) && r.reusableAt > now)
      .reduce((m, r) => Math.max(m, r.reusableAt), 0);
    if (!cooling) return { ok: true, slot: s };
    soonest = Math.min(soonest, cooling);
  }
  return Number.isFinite(soonest) ? { ok: false, reason: 'cooling', until: soonest } : { ok: false, reason: 'full' };
}

// =============================================================================
// Counting and levels
// =============================================================================

export interface BoostRow {
  id: number;
  userId: number;
  clanId: number;
  /** The seat it rides on; the clan sees this seat's character. */
  seatId: number;
  placedAt: number;
  /** The seat is still a live member seat of this clan, held by this person's character. */
  seatLive: boolean;
}

/**
 * Which placed (live, not ended) boosts count: per person, the oldest whose seat is still live, up to
 * their slots. The rest are paused (a lapse or downgrade) or dead (seat gone).
 */
export function activeBoostIds(rows: BoostRow[], slotsByUser: Map<number, number>): Set<number> {
  const byUser = new Map<number, BoostRow[]>();
  for (const r of rows) if (r.seatLive) byUser.set(r.userId, [...(byUser.get(r.userId) ?? []), r]);
  const out = new Set<number>();
  for (const [user, list] of byUser) {
    const n = slotsByUser.get(user) ?? 0;
    [...list].sort(oldestFirst).slice(0, n).forEach((r) => out.add(r.id));
  }
  return out;
}

function oldestFirst(a: { placedAt: number; id: number }, b: { placedAt: number; id: number }): number {
  return a.placedAt - b.placedAt || a.id - b.id;
}

/**
 * Of a clan's active boosts, the ones its level counts: each person's oldest PER_PERSON_CAP. The
 * wall shows the same set, so its numbers add up to the clan's count.
 */
export function countedRows<T extends BoostRow>(active: T[]): T[] {
  const perKey = new Map<string, T[]>();
  for (const r of active) {
    const k = `${r.clanId}:${r.userId}`;
    perKey.set(k, [...(perKey.get(k) ?? []), r]);
  }
  const out: T[] = [];
  for (const list of perKey.values()) out.push(...[...list].sort(oldestFirst).slice(0, PER_PERSON_CAP));
  return out;
}

/** Counted boosts per clan, from its active boosts (each person's capped at PER_PERSON_CAP). */
export function countedBoosts(active: BoostRow[]): Map<number, number> {
  const out = new Map<number, number>();
  for (const r of countedRows(active)) out.set(r.clanId, (out.get(r.clanId) ?? 0) + 1);
  return out;
}

export function levelFor(counted: number): BoostLevel {
  if (counted >= LEVEL_AT[2]) return 3;
  if (counted >= LEVEL_AT[1]) return 2;
  if (counted >= LEVEL_AT[0]) return 1;
  return 0;
}

/** Platform gifts fill only the gap to a target level; real member boosts always displace them. */
export function platformBoostsFor(organic: number, target: BoostLevel): number {
  if (target <= 0) return 0;
  return Math.max(0, LEVEL_AT[target - 1] - Math.max(0, organic));
}

/** "5 of 8 to Level 2", or null at the top. */
export function levelProgress(counted: number): { next: 1 | 2 | 3; need: number; have: number } | null {
  const lvl = levelFor(counted);
  if (lvl >= 3) return null;
  const next = (lvl + 1) as 1 | 2 | 3;
  return { next, need: LEVEL_AT[next - 1], have: counted };
}

/** The level a placement lifted its clan to, or null when it didn't lift it. */
export function levelUpFrom(before: number, after: number): BoostLevel | null {
  const a = levelFor(after);
  return a > levelFor(before) ? a : null;
}

export interface StoredLevel {
  level: number;
  /** When counted boosts fell below `level` (ms), or NaN/null while they haven't. */
  droppedAt: number | null;
}

export interface LevelState {
  /** The level whose perks apply now (counted, or a higher one still in its grace week). */
  level: BoostLevel;
  /** What the boosts alone make it. */
  countedLevel: BoostLevel;
  droppedAt: number | null;
  /** In grace: when the higher level's perks end. */
  graceEndsAt: number | null;
  /** The stored row needs writing. */
  changed: boolean;
}

/**
 * Reconcile a clan's stored level with what its boosts make it now. Rising (or holding) takes the
 * new level at once and clears any grace; falling keeps the stored level for GRACE_DAYS from the
 * first time the drop was seen, then settles on the counted level.
 */
export function reconcileLevel(stored: StoredLevel | null, counted: number, now: number): LevelState {
  const countedLevel = levelFor(counted);
  const prev = clampLevel(stored?.level ?? 0);
  const dropped = stored?.droppedAt != null && Number.isFinite(stored.droppedAt) ? stored.droppedAt : null;
  if (countedLevel >= prev) {
    return { level: countedLevel, countedLevel, droppedAt: null, graceEndsAt: null, changed: countedLevel !== prev || dropped !== null };
  }
  const since = dropped ?? now;
  const ends = since + GRACE_DAYS * DAY_MS;
  if (now < ends) return { level: prev, countedLevel, droppedAt: since, graceEndsAt: ends, changed: dropped === null };
  return { level: countedLevel, countedLevel, droppedAt: null, graceEndsAt: null, changed: true };
}

/** A platform gift as stored on clan_boost_state: a target level and an expiry (null = indefinite). */
export interface BoostGift {
  level: number | null | undefined;
  /** Stored stamp or ms; null/undefined = no end. An unreadable stamp counts as expired (fail closed). */
  expiresAt: string | number | null | undefined;
}

/** The level a gift lifts a clan to right now: 0 with no gift, a lapsed one, or level 0. */
export function giftTargetLevel(gift: BoostGift | null | undefined, now: number): BoostLevel {
  const lvl = Number(gift?.level ?? 0);
  if (!(lvl > 0)) return 0;
  const exp = gift?.expiresAt;
  if (exp != null && exp !== '') {
    const ends = typeof exp === 'number' ? exp : stampMs(exp);
    if (!(ends > now)) return 0;
  }
  return clampLevel(lvl);
}

export interface EffectiveBoost extends LevelState {
  /** Organic plus the platform's gap filler: what perks and progress read. */
  counted: number;
  organicCounted: number;
  platformCount: number;
  giftTargetLevel: BoostLevel;
  /** The organic-only reconcile: what clan_boost_state.level/dropped_at store (a gift never does). */
  organic: LevelState;
}

/**
 * A clan's boost level with any platform gift on top. The stored level and its grace week track the
 * members' own boosts only; the gift adds just enough boosts to reach its target
 * (platformBoostsFor), so real boosts displace it one for one, a clan already above the target keeps
 * its own higher level, and when the gift lapses or is cleared the clan falls straight back to its
 * organic level — or to that level's grace week, if one is running.
 */
export function effectiveBoostLevel(stored: StoredLevel | null, organic: number, gift: BoostGift | null | undefined, now: number): EffectiveBoost {
  const state = reconcileLevel(stored, organic, now);
  const target = giftTargetLevel(gift, now);
  const n = Math.max(0, organic);
  const platformCount = platformBoostsFor(n, target);
  const counted = n + platformCount;
  const countedLevel = levelFor(counted);
  const level = Math.max(state.level, countedLevel) as BoostLevel;
  return {
    ...state,
    level,
    countedLevel,
    graceEndsAt: level > countedLevel ? state.graceEndsAt : null,
    counted,
    organicCounted: n,
    platformCount,
    giftTargetLevel: target,
    organic: state,
  };
}

function clampLevel(n: number): BoostLevel {
  return n >= 3 ? 3 : n >= 2 ? 2 : n >= 1 ? 1 : 0;
}

// =============================================================================
// Perks (what a level shows; never anything that ranks, scores or seats)
// =============================================================================

export interface BoostPerks {
  /** "Boosted" badge on the clan home hero, Clan Hall cards and search. */
  badge: boolean;
  /** Listed above unboosted clans in the Clan Hall's default order and its search results. */
  priority: boolean;
  /** The clan name in the Supporter gradient. */
  gradientName: boolean;
  /** A featured row at the top of the Clan Hall. */
  featured: boolean;
  /** An animated banner plays (below this it shows its still frame). */
  animatedBanner: boolean;
  /** A short clan-written recruiting line for visitors. */
  recruitingLine: boolean;
  /** The gradient name moves (still for anyone who asked for less motion). */
  animatedName: boolean;
  /** The Spotlight section at the top of the Clan Hall, above Featured. */
  spotlight: boolean;
  /** One recruitment post a month into Anvil's own Discord. */
  discordPost: boolean;
}

/** The exact source palettes shared by the website and RuneLite surfaces. */
export const CLAN_BOOST_GRADIENTS = {
  still: ['#ff9a5a', '#e05ad0', '#7a8cff'],
  animated: ['#ffd27a', '#ff7ab8', '#7ae0ff'],
} as const;

export interface ClanBoostNameStyle {
  stops: `#${string}`[];
  /** Worn as-is on dark backgrounds (site, plugin panel, Discord); else `stops` is adapted there. */
  dark?: { stops: `#${string}`[] };
  /** Worn as-is on light backgrounds (opaque game chat); else `stops` is adapted there. */
  light?: { stops: `#${string}`[] };
}

const BOOST_HEX = /^#[0-9a-f]{6}$/;
const BOOST_SURFACES = ['dark', 'light'] as const;

/** 1–4 '#rrggbb' stops (case and spaces forgiven), else null. */
function boostStops(raw: unknown): `#${string}`[] | null {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 4) return null;
  const stops = raw.map((s) => (typeof s === 'string' ? s.trim().toLowerCase() : ''));
  return stops.every((s) => BOOST_HEX.test(s)) ? (stops as `#${string}`[]) : null;
}

/**
 * Stored/custom clan-name colours; malformed legacy data safely falls back to the level palette. A
 * malformed surface override is dropped on its own (the main colours still apply).
 */
export function clanBoostNameStyle(value: unknown): ClanBoostNameStyle | null {
  let input = value;
  if (typeof input === 'string') {
    try { input = JSON.parse(input); } catch { return null; }
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const o = input as Record<string, unknown>;
  const stops = boostStops(o.stops);
  if (!stops) return null;
  const style: ClanBoostNameStyle = { stops };
  for (const surface of BOOST_SURFACES) {
    const v = o[surface];
    const own = v && typeof v === 'object' && !Array.isArray(v) ? boostStops((v as { stops?: unknown }).stops) : null;
    if (own) style[surface] = { stops: own };
  }
  return style;
}

export type ClanNameStyleCheck = { ok: true; style: ClanBoostNameStyle | null } | { ok: false; error: string };

/**
 * A clan-name style sent by clan staff, checked strictly: `null` or `{stops: []}` resets it; each
 * surface override is cleared by `null` / `{}` / `{stops: []}` and otherwise follows the same 1–4 hex rule.
 * Level gating is the caller's (it needs the database).
 */
export function validateClanBoostNameStyle(raw: unknown): ClanNameStyleCheck {
  if (raw == null) return { ok: true, style: null };
  if (typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, error: 'Send a style object.' };
  const o = raw as Record<string, unknown>;
  if (Array.isArray(o.stops) && o.stops.length === 0) return { ok: true, style: null };
  const stops = boostStops(o.stops);
  if (!stops) return { ok: false, error: 'Choose between one and four #RRGGBB colours.' };
  const style: ClanBoostNameStyle = { stops };
  for (const surface of BOOST_SURFACES) {
    const v = o[surface];
    if (v == null) continue;
    if (typeof v !== 'object' || Array.isArray(v)) return { ok: false, error: 'Send a style object.' };
    const list = (v as { stops?: unknown }).stops;
    if (list == null || (Array.isArray(list) && list.length === 0)) continue;
    const own = boostStops(list);
    if (!own) return { ok: false, error: `${surface === 'dark' ? 'Dark' : 'Light'} backgrounds: choose between one and four #RRGGBB colours.` };
    style[surface] = { stops: own };
  }
  return { ok: true, style };
}

type BoostInk = { color: `#${string}`; grad?: `#${string}`[] };

function boostInkOf(stops: `#${string}`[]): BoostInk {
  return { color: stops[0], ...(stops.length > 1 ? { grad: [...stops] } : {}) };
}

/**
 * A boosted clan's name colours (null below Level 1), with its own dark / light looks riding along
 * raw for supporterStyle's inkForSurface to pick.
 */
export function clanBoostInk(
  level: number,
  style?: ClanBoostNameStyle | null,
): { color: `#${string}`; grad?: `#${string}`[]; move?: boolean; dark?: BoostInk; light?: BoostInk } | null {
  if (level < 1) return null;
  const custom = clanBoostNameStyle(style);
  const grad = custom?.stops ?? ([...(level >= 2 ? CLAN_BOOST_GRADIENTS.animated : CLAN_BOOST_GRADIENTS.still)] as `#${string}`[]);
  return {
    color: grad[0],
    ...(grad.length > 1 ? { grad } : {}),
    ...(level >= 2 && grad.length > 1 ? { move: true } : {}),
    ...(custom?.dark ? { dark: boostInkOf(custom.dark.stops) } : {}),
    ...(custom?.light ? { light: boostInkOf(custom.light.stops) } : {}),
  };
}

export function boostPerks(level: number): BoostPerks {
  return {
    badge: level >= 1,
    priority: level >= 1,
    gradientName: level >= 1,
    featured: level >= 2,
    animatedBanner: level >= 2,
    recruitingLine: level >= 2,
    animatedName: level >= 2,
    spotlight: level >= 3,
    discordPost: level >= 3,
  };
}

/** The CSS class for a clan's name at this level (globals.css `.boost-name-*`), or '' for none. */
export function boostNameClass(level: number): string {
  return level >= 2 ? 'boost-name-animated' : level >= 1 ? 'boost-name' : '';
}

/** Clan Hall order: boosted clans first (higher level first), then whatever order the caller had. */
export function byBoostLevel(a: { boostLevel?: number | null }, b: { boostLevel?: number | null }): number {
  return (b.boostLevel ?? 0) - (a.boostLevel ?? 0);
}

// =============================================================================
// The boosters wall and badges
// =============================================================================

export type BoostBadge =
  | { kind: 'first' }
  | { kind: 'tenure'; months: (typeof TENURE_MONTHS)[number] }
  | { kind: 'levelup'; level: BoostLevel };

export interface WallRow extends BoostRow {
  /** The seat's character, as the clan knows it. */
  rsn: string;
  levelUp: number | null;
}

export interface WallEntry {
  /** The seat (or, with names hidden, just a position: see wallForViewer). */
  seatId: number;
  /** The seat's character, or null where this viewer may not see names (wallForViewer). */
  rsn: string | null;
  /** Counted boosts riding on this seat. */
  boosts: number;
  /** The earliest of them (ms): "boosting since". */
  since: number;
  badges: BoostBadge[];
}

/** The highest tenure step reached by `months` of continuous boosting, or null below the first. */
export function tenureBadge(since: number, now: number): (typeof TENURE_MONTHS)[number] | null {
  const m = wholeMonths(since, now);
  return [...TENURE_MONTHS].reverse().find((s) => m >= s) ?? null;
}

/**
 * Who boosts this clan, as the clan may see it: one entry per SEAT (a character), never grouped by
 * person, from the counted boosts only. Most boosts first, then the longest standing.
 *
 * `firstUserId` is whoever placed this clan's first boost ever (ended rows included); their earliest
 * seat on the wall wears "First booster". Tenure counts from the seat's earliest counted boost, so a
 * move or a removal starts it over. "Level-up" is the highest level any of the seat's live boosts
 * lifted the clan to.
 */
export function boostersWall(active: WallRow[], firstUserId: number | null, now: number): WallEntry[] {
  const counted = countedRows(active);
  const bySeat = new Map<number, WallRow[]>();
  for (const r of counted) bySeat.set(r.seatId, [...(bySeat.get(r.seatId) ?? []), r]);
  let firstSeat: number | null = null;
  if (firstUserId != null) {
    const mine = counted.filter((r) => r.userId === firstUserId).sort(oldestFirst);
    firstSeat = mine[0]?.seatId ?? null;
  }
  const out: WallEntry[] = [];
  for (const [seatId, rows] of bySeat) {
    const since = Math.min(...rows.map((r) => r.placedAt));
    const badges: BoostBadge[] = [];
    if (seatId === firstSeat) badges.push({ kind: 'first' });
    const t = tenureBadge(since, now);
    if (t) badges.push({ kind: 'tenure', months: t });
    const lifted = Math.max(0, ...rows.map((r) => r.levelUp ?? 0));
    if (lifted > 0) badges.push({ kind: 'levelup', level: clampLevel(lifted) });
    out.push({ seatId, rsn: rows[0].rsn, boosts: rows.length, since, badges });
  }
  return out.sort((a, b) => b.boosts - a.boosts || a.since - b.since || (a.rsn ?? '').localeCompare(b.rsn ?? ''));
}

/**
 * The wall as a given viewer may see it. A clan decides whether strangers see its members' names
 * (the Clan Hall card's "public names", lib/clanHall hallConfig); where they may not, every name AND
 * seat id is stripped here, on the server, so the counts, dates and badges are all that leave it.
 */
export function wallForViewer(wall: WallEntry[], showNames: boolean): WallEntry[] {
  if (showNames) return wall;
  return wall.map((e, i) => ({ ...e, seatId: i + 1, rsn: null }));
}

export function badgeLabel(b: BoostBadge): string {
  if (b.kind === 'first') return 'First booster';
  if (b.kind === 'tenure') return b.months === 1 ? '1 month' : b.months === 12 ? '1 year' : `${b.months} months`;
  return `Level-up ${b.level}`;
}

export function badgeTitle(b: BoostBadge): string {
  if (b.kind === 'first') return 'The first to ever boost this clan';
  if (b.kind === 'tenure') return `Boosting this clan for ${badgeLabel(b)} straight`;
  return `Their boost lifted the clan to Level ${b.level}`;
}

// =============================================================================
// Discord
// =============================================================================

/**
 * The booster gem on a Discord embed's author line, for a post into a clan this character boosts —
 * in place of the Supporter star (lib/supporterTiers withSupporterAuthor), which every other clan
 * still sees. Only an embed with an author and no icon of its own; returns a copy.
 */
export function withBoosterAuthor<T extends Record<string, unknown>>(embed: T, origin: string): T {
  const author = embed.author as { name?: unknown; icon_url?: unknown } | undefined;
  if (!author || typeof author.name !== 'string' || author.icon_url) return embed;
  return { ...embed, author: { ...author, icon_url: `${origin}/icons/booster.png` } };
}

// =============================================================================
// Clan-written text: the recruiting line (L2) and the Discord recruitment post (L3)
// =============================================================================

/** Defuse Discord mentions: @everyone / @here and <@…>, <@&…>, <#…> never ping or link. */
function defuseMentions(s: string): string {
  return s
    .replace(/<(@[!&]?|#)\d+>/g, '')
    .replace(/@(everyone|here)/gi, '@​$1');
}

/** One line, no control characters, capped. Empty → null (cleared). */
export function cleanRecruitingLine(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const s = defuseMentions(raw.replace(/[\u0000-\u001f\u007f]+/g, ' ')).replace(/\s+/g, ' ').trim();
  return s ? s.slice(0, RECRUITING_LINE_MAX) : null;
}

export type RecruitText = { ok: true; text: string } | { ok: false; error: string };

/** The monthly recruitment post's text: mentions defused, blank runs squeezed, RECRUIT_POST_MAX at most. */
export function cleanRecruitPost(raw: unknown): RecruitText {
  if (typeof raw !== 'string') return { ok: false, error: 'Write the post first.' };
  const s = defuseMentions(
    raw
      .replace(/\r\n?/g, '\n')
          .replace(/[\u0000-\u0009\u000b-\u001f\u007f]+/g, ' '),
  )
    .split('\n')
    .map((l) => l.replace(/[ \t]+/g, ' ').trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (s.length < RECRUIT_POST_MIN) return { ok: false, error: `Say a little more: at least ${RECRUIT_POST_MIN} characters.` };
  if (s.length > RECRUIT_POST_MAX) return { ok: false, error: `Keep it to ${RECRUIT_POST_MAX} characters (it's ${s.length}).` };
  return { ok: true, text: s };
}

/** The first instant of the UTC calendar month after `ms`. */
export function nextMonthStart(ms: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
}

/** One recruitment post per clan per UTC calendar month. */
export function recruitPostAllowed(lastPostAt: number | null, now: number): { ok: true } | { ok: false; nextAt: number } {
  if (lastPostAt == null || !Number.isFinite(lastPostAt)) return { ok: true };
  const next = nextMonthStart(lastPostAt);
  return now >= next ? { ok: true } : { ok: false, nextAt: next };
}
