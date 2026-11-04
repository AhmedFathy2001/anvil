// Friends events — the rules. Pure: no database import (tests/pure-module-imports).
//
// A Supporter perk: small private events for friends, hosted from the person's own profile rather
// than from a clan or a creator space. The machinery is the creator-space machinery (the wizard,
// boards, auto-verified tiles, KC/XP tracking, the plugin panel all just work) on a HIDDEN host of
// its own: a `clans` row with `kind = 'friends'`, one per person, made on first use (lib/friendEvents).
// A hidden host rather than a flag on events, for the reason lib/lab gives: every place that lists,
// posts, ranks or indexes an event is already clan-scoped, and a host that is platform-hidden and
// members-only is missed by all of them at once.
//
// ONE EVENT, ONE HOST, ONE CAP. An event belongs to exactly one host and its cap comes only from that
// host: a friends event is capped by the owner's Supporter tier (this module), a creator-space event
// by the space's creator plan (lib/creatorPlans). The two never add up — a creator who is also a
// Patron gets 50-player friends events AND their creator plan's events, and neither borrows from the
// other. Live events are counted per host too, so friends events never use a creator allowance.
//
// THE PLAYER CAP IS AN AGGREGATE, not a per-event number: a Patron's 50 is the most SEATS (sign-ups
// on a board) all of their friends events hold at any one moment — events whose time windows overlap
// add up, events that never overlap each get the full cap. Seats, not people: somebody on two
// overlapping boards counts twice, the same way two boards cost two boards' worth of tracking. It is
// a peak over time (peakSeats, a sweep over the windows), so a join is refused only when it would
// push that peak over the cap somewhere inside the event's own window, and a date change only when
// it would raise the peak over the cap (shortening, or moving events apart, never does). An undated
// draft has no window and joins nothing but itself; an open-ended event counts until it is ended.
// The creator plans are getting the same rule on their own branch; the two helpers can become one.
//
// ENFORCED ALWAYS, unlike the creator meters (which wait for FREEMIUM_ENFORCED): these caps are the
// perk's own size, not a growth-phase upsell, and a non-Supporter simply cannot host. On a lapse or a
// downgrade nobody is kicked — an event keeps every player it has — but a NEW join over the cap is
// refused, and a new or re-dated event needs a tier in force.
//
// WHO COUNTS AS A SUPPORTER: whatever tier is in force for them (lib/supporterTiers supporterState):
// paid, cancelled-but-paid-up, staff-gifted, and time earned through invites (referrals). That is the
// head-to-head precedent (lib/h2hRules h2hCap reads the same tier); boost slots are the one perk that
// leaves referral time out, because a boost is spent on somebody else's clan.

import { parseStamp } from '@/lib/dbTime';
import { eventStage } from '@/lib/eventStage';
import type { FeatureKey } from '@/lib/features';
import type { SupporterTierId } from '@/lib/supporterTiers';

/** The `clans.kind` of a friends host. */
export const FRIENDS_KIND = 'friends';

export function isFriendsHost(clan: { kind?: string | null } | null | undefined): boolean {
  return clan?.kind === FRIENDS_KIND;
}

export interface FriendsCaps {
  /** Players on one event (sign-ups on the board, the same count the creator meter uses). */
  playersPerEvent: number;
  /** Events live at once (dated and not ended — lib/creatorPlans isLiveEvent). */
  liveEvents: number;
}

/** The caps by Supporter tier. The one table; the /supporter page and every gate read it. */
export const FRIENDS_CAPS: Record<SupporterTierId, FriendsCaps> = {
  supporter: { playersPerEvent: 10, liveEvents: 1 },
  champion: { playersPerEvent: 25, liveEvents: 1 },
  patron: { playersPerEvent: 50, liveEvents: 2 },
};

/** This tier's caps, or null for somebody with no tier in force (they may not host). */
export function friendsCapsFor(tier: SupporterTierId | null | undefined): FriendsCaps | null {
  return tier && tier in FRIENDS_CAPS ? FRIENDS_CAPS[tier] : null;
}

/** "Up to 25 players · 1 live event at a time" — the perk line for a tier. */
export function friendsCapsLine(tier: SupporterTierId): string {
  const c = FRIENDS_CAPS[tier];
  return `Up to ${c.playersPerEvent} players · ${c.liveEvents} live event${c.liveEvents === 1 ? '' : 's'} at a time`;
}

/**
 * Same rule as lib/creatorPlans isLiveEvent (kept here so this module stays free of the creator
 * catalogue): a start date, and not ended. An undated draft does not count.
 */
export function isLiveFriendsEvent(e: { startDate: string | null; endDate: string | null; forceEndedAt: string | null }, now = Date.now()): boolean {
  return e.startDate != null && eventStage(e, now) !== 'wrap';
}

// ── Windows and the peak ────────────────────────────────────────────────────────────────────────

/** An event's time on the clock, half-open [start, end): touching events do not overlap. */
export interface TimeWindow {
  start: number;
  /** Infinity for an event with no end yet. */
  end: number;
}

/**
 * An event's window: its start to the earlier of its end date and the moment it was ended by hand.
 * Null for an undated draft (or a window that closes before it opens), which overlaps nothing.
 */
export function eventWindow(e: { startDate: string | null; endDate: string | null; forceEndedAt: string | null }): TimeWindow | null {
  const start = parseStamp(e.startDate);
  if (start == null) return null;
  const end = Math.min(parseStamp(e.endDate) ?? Infinity, parseStamp(e.forceEndedAt) ?? Infinity);
  return end > start ? { start, end } : null;
}

/** One of a host's events, for the peak: its window (null = undated) and the seats on its board. */
export interface SeatLoad {
  id: number;
  window: TimeWindow | null;
  seats: number;
}

/**
 * The most seats held at once by these events at any moment inside `within` (a sweep line over the
 * clipped windows). Undated events (window null) are not on the clock and add nothing.
 */
export function peakSeats(loads: readonly SeatLoad[], within: TimeWindow): number {
  const marks: { at: number; delta: number }[] = [];
  for (const l of loads) {
    if (!l.window || l.seats <= 0) continue;
    const start = Math.max(l.window.start, within.start);
    const end = Math.min(l.window.end, within.end);
    if (!(end > start)) continue;
    marks.push({ at: start, delta: l.seats }, { at: end, delta: -l.seats });
  }
  // Ends before starts at the same instant: half-open windows, so a board ending at 18:00 and one
  // starting at 18:00 are never both counted.
  marks.sort((a, b) => a.at - b.at || a.delta - b.delta);
  let now = 0;
  let peak = 0;
  for (const m of marks) {
    now += m.delta;
    if (now > peak) peak = now;
  }
  return peak;
}

/**
 * The peak this event takes part in: across its own window, with every other event's seats on top.
 * An undated event is alone, so its peak is its own seats.
 */
export function peakFor(target: SeatLoad, others: readonly SeatLoad[]): number {
  if (!target.window) return Math.max(0, target.seats);
  return peakSeats([target, ...others.filter((o) => o.id !== target.id)], target.window);
}

// ── Words ────────────────────────────────────────────────────────────────────────────────────────

export const FRIENDS_NEEDS_SUPPORTER = 'Hosting for friends is a Supporter perk. Become a Supporter to host your own events.';
export const FRIENDS_EVENT_FULL = 'This event is full. Ask the host — they can only fit so many friends.';

function liveLimitMessage(tier: SupporterTierId, limit: number): string {
  const name = tier === 'supporter' ? 'Supporter' : tier === 'champion' ? 'Champion' : 'Patron';
  const upsell = tier === 'patron' ? '' : ' Patrons can run two at once.';
  return limit === 1
    ? `As a ${name} you can run one friends event at a time. End your current one first.${upsell}`
    : `As a ${name} you can run ${limit} friends events at a time. End one first.`;
}

// ── Verdicts ─────────────────────────────────────────────────────────────────────────────────────

export type FriendsVerdict = { ok: true } | { ok: false; error: string; reason: 'not-supporter' | 'live-limit' | 'full' };

/** May this person make a new friends event (or open a drafted one)? Needs a tier in force. */
export function mayHostFriends(tier: SupporterTierId | null | undefined): FriendsVerdict {
  return friendsCapsFor(tier) ? { ok: true } : { ok: false, reason: 'not-supporter', error: FRIENDS_NEEDS_SUPPORTER };
}

/**
 * May one more of this host's events go live (create dated, clone, re-date, resume), with
 * `liveEvents` OTHER events live now? Needs a tier in force, and room under its live limit.
 */
export function friendsLiveVerdict(opts: { tier: SupporterTierId | null | undefined; liveEvents: number }): FriendsVerdict {
  const caps = friendsCapsFor(opts.tier);
  if (!caps || !opts.tier) return { ok: false, reason: 'not-supporter', error: FRIENDS_NEEDS_SUPPORTER };
  if (opts.liveEvents < caps.liveEvents) return { ok: true };
  return { ok: false, reason: 'live-limit', error: liveLimitMessage(opts.tier, caps.liveEvents) };
}

/** The player cap on one friends event for the owner's tier now. 0 when they have none: no new joins. */
export function friendsPlayerCap(tier: SupporterTierId | null | undefined): number {
  return friendsCapsFor(tier)?.playersPerEvent ?? 0;
}

/**
 * May `adding` more seats join `target` (its seats as they are now), given the host's other events?
 * Refused when the peak inside the target's window would go over the owner's CURRENT cap. Never
 * refuses an edit (`adding` 0), so a lapse or downgrade keeps everyone it has. Enforced always.
 */
export function friendsJoinVerdict(opts: {
  tier: SupporterTierId | null | undefined;
  target: SeatLoad;
  others: readonly SeatLoad[];
  adding: number;
}): FriendsVerdict {
  if (opts.adding <= 0) return { ok: true };
  const peak = peakFor({ ...opts.target, seats: opts.target.seats + opts.adding }, opts.others);
  if (peak <= friendsPlayerCap(opts.tier)) return { ok: true };
  return { ok: false, reason: 'full', error: FRIENDS_EVENT_FULL };
}

export const FRIENDS_REDATE_OVER =
  'Those dates overlap your other friends events by more players than your Supporter tier holds at once. Pick dates that overlap less, or end one first.';

/**
 * May one event's dates change from `before` to `after` (same seats), given the host's other events?
 * Refused only when the new peak is over the cap AND higher than the peak it had before — so
 * shortening an event, moving events apart, or editing an event that was already over after a
 * downgrade are always allowed; only a change that makes the overlap worse past the cap is not.
 */
export function friendsRedateVerdict(opts: {
  tier: SupporterTierId | null | undefined;
  before: SeatLoad | null;
  after: SeatLoad;
  others: readonly SeatLoad[];
}): FriendsVerdict {
  const newPeak = peakFor(opts.after, opts.others);
  // What was already there: the event's own peak before, or the others' alone in the new window (an
  // empty board landing in an already-full window adds nothing, so it is not what made it full).
  const others = opts.others.filter((o) => o.id !== opts.after.id);
  const oldPeak = Math.max(
    opts.before ? peakFor(opts.before, others) : 0,
    opts.after.window ? peakSeats(others, opts.after.window) : 0,
  );
  if (newPeak <= friendsPlayerCap(opts.tier) || newPeak <= oldPeak) return { ok: true };
  return { ok: false, reason: 'full', error: FRIENDS_REDATE_OVER };
}

/** The snapshot of one host event the schedule check compares (lib/friendEvents withFriendsSchedule). */
export interface FriendsEventRow {
  id: number;
  startDate: string | null;
  endDate: string | null;
  forceEndedAt: string | null;
  seats: number;
}

function loadOf(r: FriendsEventRow): SeatLoad {
  return { id: r.id, window: eventWindow(r), seats: r.seats };
}

function sameWindow(a: TimeWindow | null, b: TimeWindow | null): boolean {
  return a === b || (a != null && b != null && a.start === b.start && a.end === b.end);
}

/**
 * Everything a write to a host's events must still satisfy, comparing the host's events before the
 * write with after it (one transaction, under the host's lock). For each event the write CHANGED:
 *
 *   new                                   needs a tier in force (creating is the perk)
 *   now live and was not (new, dated,     needs a tier in force and room under the live limit,
 *     re-dated, resumed)                    counting the host's OTHER live events
 *   its window moved                      friendsRedateVerdict
 *
 * Events the write did not touch are never judged, so an unrelated edit after a lapse goes through.
 */
export function friendsScheduleVerdict(opts: {
  tier: SupporterTierId | null | undefined;
  before: readonly FriendsEventRow[];
  after: readonly FriendsEventRow[];
  now?: number;
}): FriendsVerdict {
  const now = opts.now ?? Date.now();
  const prior = new Map(opts.before.map((r) => [r.id, r]));
  const afterLoads = opts.after.map(loadOf);
  for (const row of opts.after) {
    const was = prior.get(row.id) ?? null;
    if (!was) {
      const may = mayHostFriends(opts.tier);
      if (!may.ok) return may;
    }
    const liveNow = isLiveFriendsEvent(row, now);
    if (liveNow && !(was && isLiveFriendsEvent(was, now))) {
      const others = opts.after.filter((r) => r.id !== row.id && isLiveFriendsEvent(r, now)).length;
      const live = friendsLiveVerdict({ tier: opts.tier, liveEvents: others });
      if (!live.ok) return live;
    }
    const load = loadOf(row);
    if (!was || !sameWindow(eventWindow(was), load.window)) {
      const others = afterLoads.filter((l) => l.id !== row.id);
      const v = friendsRedateVerdict({ tier: opts.tier, before: was ? loadOf(was) : null, after: load, others });
      if (!v.ok) return v;
    }
  }
  return { ok: true };
}

// ── The invite link ──────────────────────────────────────────────────────────────────────────────

/** 24 url-safe characters (144 bits from 18 random bytes, base64url). */
export const INVITE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{24}$/;

export function isInviteToken(v: unknown): v is string {
  return typeof v === 'string' && INVITE_TOKEN_PATTERN.test(v);
}

/** The path of a friends event's invite link, on the apex. */
export function friendsInvitePath(token: string): string {
  return `/f/${token}`;
}

/** Everything a friends host has off: it is a board for friends, not a clan with a Discord and a coffer. */
export const FRIENDS_FEATURES_OFF: readonly FeatureKey[] = [
  'weekly',
  'coffer',
  'clanHall',
  'announce',
  'funMessages',
  'fees',
  'poolFormats',
  'missions',
  'survey',
];

// ── The host row ─────────────────────────────────────────────────────────────────────────────────

/** A friends host's name, shown only to its owner and their players ("Ahmed's friends"). */
export function friendsHostName(displayName: string | null | undefined): string {
  const who = (displayName ?? '').trim().slice(0, 40);
  return who ? `${who}’s friends` : 'Friends events';
}

/**
 * Admin pages a friends host has: its events, and nothing else. No dashboard, people, Discord,
 * branding or plan — the host's home for these is /host/friends. Whole path segments.
 */
export const FRIENDS_ADMIN_PATHS = ['/admin/events'] as const;

/** Event admin sub-pages that make no sense for a private friends board (co-hosts, Discord, overlay). */
export const FRIENDS_HIDDEN_EVENT_TABS = ['discord', 'overlay', 'cohosts', 'co-hosts'] as const;

export function friendsAllowsAdminPath(pathname: string): boolean {
  if (!FRIENDS_ADMIN_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) return false;
  const parts = pathname.split('/').filter(Boolean); // admin, events, <id>, <tab>
  if (parts[1] === 'events' && parts[2] === 'weekly') return false;
  const tab = parts[3];
  return !(tab && (FRIENDS_HIDDEN_EVENT_TABS as readonly string[]).includes(tab));
}

/** Public pages of a friends host: an event's own pages only. Everything else goes to /host/friends. */
export function friendsAllowsPublicPath(pathname: string): boolean {
  return /^\/events\/\d+(\/|$)/.test(pathname);
}
