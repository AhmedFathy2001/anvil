// Creator-space plans — the rules. Pure: no database import (tests/pure-module-imports).
//
// A creator space (lib/creatorSpaces) is a `clans` row on a plan, but from ITS OWN catalogue
// (lib/creatorCatalog: creator_free … creator_partner, own prices, own Gumroad products), never the
// clan ladder in lib/plans. The webhook routes a sale to the right one (lib/billingCatalog). Two things
// make a creator plan what it is, and this module is both of them:
//
//   THE METER is players enrolled AT ONCE across the host's events (`CreatorPlan.playersPerEvent`,
//     named from when it was per event), never the roster. Every viewer who ever joined a streamer's
//     event keeps a guest seat, so a roster cap would bill a creator for last year's audience. Events
//     whose dates overlap share the cap; events apart get it each (lib/concurrentSeats: the peak of
//     players live at one moment, counted per event they are in — one person on two overlapping
//     boards is two).
//   THE PERKS are streamer things: stream-platform entry gates, the `!join` chat bot, an overlay
//     without the Anvil mark, featured ordering in the directory, more than one live event at once.
//
// EVERY GATE GOES THROUGH creatorCan (lib/creatorCatalog, the creator twin of clanCan), so while
// FREEMIUM_ENFORCED is off — the generous phase, the default — nothing here refuses anybody: a full event still seats, a Free space
// can still gate on Twitch. What the off-state DOES do is say so: the dashboard's plan card shows the
// meter and the tier that would fit, so nobody is surprised the day the switch flips.
//
// The one exception is `featuredListing`: it is a perk that only re-orders, never a door, so it
// follows the plan actually paid for, enforced or not. A Silver creator paid to be featured today.

import { freemiumEnforced } from '@/lib/entitlements';
import { eventStage } from '@/lib/eventStage';
import {
  clipInterval,
  eventWindow,
  peakConcurrentSeats,
  roomVerdict,
  windowChangeVerdict,
  type DatedEvent,
  type SeatWindow,
} from '@/lib/concurrentSeats';
import {
  CREATOR_BUYABLE,
  CREATOR_FREE_ID,
  CREATOR_PLANS,
  creatorCan,
  creatorMinPlanNameFor,
  creatorPlanHasCapability,
  creatorPlanFromLegacy,
  creatorPlanOf,
  creatorPlanRank,
  type CreatorPlan,
} from '@/lib/creatorCatalog';

export { CREATOR_BUYABLE } from '@/lib/creatorCatalog';

/**
 * The plan to meter a host by, or null when nothing is metered: an ordinary clan (its roster is its
 * meter), or any host while FREEMIUM_ENFORCED is off. The race-safe writers (lib/creatorPlansDb
 * withEventRoom / withLiveEventSlot) take this and skip their lock and check on null.
 */
export function meteredPlan(clan: { kind?: string | null; plan?: string | null } | null | undefined): string | null {
  return clan && clan.kind === 'creator' && freemiumEnforced() ? (clan.plan ?? CREATOR_FREE_ID) : null;
}

/**
 * The CREATOR plan id that meters this host's streamer features (the players-at-once cap, stream gates,
 * `!join`, the overlay mark). A creator space: its own plan. A clan with Streaming on: its clan tier
 * read as the creator tier of the same rank (lib/creatorCatalog CREATOR_PLAN_FROM_CLAN_PLAN — Bronze
 * clan → creator Bronze, Custom → Partner), computed here and NEVER stored: a clan row only ever holds a
 * clan plan id (the `clans_plan_matches_kind` check). Pass the result to every helper in this module.
 */
export function streamPlanId(host: { kind?: string | null; plan?: string | null } | null | undefined): string {
  if (host?.kind === 'creator') return host.plan ?? CREATOR_FREE_ID;
  return creatorPlanFromLegacy(host?.plan).id;
}

/**
 * Does this event count as live for the one-event-at-a-time limit? It has a start date (scheduled or
 * running) and hasn't ended. An undated draft doesn't count: a host can keep drafts around and still
 * make their next event. Setting a date (or pressing Start now) is when the limit is checked. Same rule
 * as liveEventCount.
 */
export function isLiveEvent(e: { startDate: string | null; endDate: string | null; forceEndedAt: string | null }, now = Date.now()): boolean {
  return e.startDate != null && eventStage(e, now) !== 'wrap';
}

/**
 * The player cap for this plan string: players enrolled at once across the host's events that run
 * at the same time (lib/concurrentSeats). Null = no cap.
 */
export function playersAtOnceCap(clanPlan: string | null | undefined): number | null {
  return creatorPlanOf(clanPlan).playersPerEvent;
}

/** The cap as a short label: "Up to 50 players at once" / "No player cap". */
export function playersCapLabel(plan: CreatorPlan): string {
  return plan.playersPerEvent == null ? 'No player cap' : `Up to ${plan.playersPerEvent.toLocaleString('en-US')} players at once`;
}

/** How many live events at once. Null = several (no fixed number). */
export function liveEventLimit(plan: CreatorPlan): number | null {
  return creatorPlanHasCapability(plan, 'concurrent-events') ? null : 1;
}

/** Are this many players at once over what the plan allows? Pure arithmetic — says nothing about enforcing. */
export function overPlayerCap(clanPlan: string | null | undefined, players: number): boolean {
  const cap = playersAtOnceCap(clanPlan);
  return cap != null && players > cap;
}

/** The smallest buyable tier whose cap holds this many players at once; Partner when none does. */
export function planForPlayers(players: number): CreatorPlan {
  return CREATOR_BUYABLE.find((p) => p.playersPerEvent != null && p.playersPerEvent >= players) ?? CREATOR_PLANS.creator_partner;
}

/** The next buyable tier above this one, or null at Gold / Partner. */
export function nextCreatorPlan(clanPlan: string | null | undefined): CreatorPlan | null {
  const rank = creatorPlanRank(creatorPlanOf(clanPlan));
  return CREATOR_BUYABLE.find((p) => creatorPlanRank(p) > rank) ?? null;
}

// ── Players at once ──────────────────────────────────────────────────────────────────────────────

/** How a viewer's refusal opens. Plain: it is not their fault and not a glitch. */
export const EVENT_FULL_MESSAGE = 'This event is full.';

/** "Silver (300 at once)" / "a Partner plan": the tier that would hold this many players at once. */
function tierThatFits(players: number): string {
  const p = planForPlayers(players);
  return p.playersPerEvent == null ? 'a Partner plan' : `${p.name} (${p.playersPerEvent.toLocaleString('en-US')} at once)`;
}

/**
 * What a viewer reads when there is no room: the event is full because the host's plan counts every
 * event of theirs running at the same time together, and which tier would make room.
 */
export function eventFullMessage(clanPlan: string | null | undefined, needed: number): string {
  const plan = creatorPlanOf(clanPlan);
  const cap = (plan.playersPerEvent ?? 0).toLocaleString('en-US');
  return `${EVENT_FULL_MESSAGE} The host’s ${plan.name} plan seats ${cap} players at once, counted across all their events running at the same time. Ask the host — ${tierThatFits(needed)} would make room.`;
}

export type RoomVerdict = { ok: true } | { ok: false; error: string; cap: number; total: number };

/** One of the host's metered events with its dates and how many are on its board. */
export interface HostEventSeats extends DatedEvent {
  id: number;
  name: string;
  /** On-board sign-ups (ON_BOARD_STATUSES): enrolments, so one person on two boards is two. */
  seats: number;
}

/** The host's events as sweep windows: undated drafts (and events that never ran) have none. */
export function seatWindows(rows: readonly HostEventSeats[]): SeatWindow[] {
  return rows.flatMap((r) => {
    const w = eventWindow(r);
    return w ? [{ id: r.id, ...w, seats: r.seats }] : [];
  });
}

/**
 * May `adding` more players join an event that has `players` on it now?
 *
 * The cap is players AT ONCE across the host's events (lib/concurrentSeats roomVerdict): pass the
 * event's own `dates` and the host's `others` and anything overlapping this event's window counts
 * too; leave them out and the event is judged on its own (an undated draft, which overlaps nothing).
 *
 * Only ever refuses when FREEMIUM_ENFORCED is on. Somebody already on the board (`adding` 0, an edit)
 * is never refused, and a host already over the cap after a downgrade keeps everyone it has.
 */
export function eventRoomVerdict(opts: {
  clanPlan: string | null | undefined;
  players: number;
  adding: number;
  eventId?: number;
  dates?: DatedEvent | null;
  others?: readonly HostEventSeats[];
  now?: number;
}): RoomVerdict {
  if (!freemiumEnforced() || opts.adding <= 0) return { ok: true };
  const cap = playersAtOnceCap(opts.clanPlan);
  if (cap == null) return { ok: true };
  const id = opts.eventId ?? -1;
  const v = roomVerdict({
    cap,
    target: { id, window: opts.dates ? eventWindow(opts.dates) : null, seats: opts.players },
    others: seatWindows((opts.others ?? []).filter((r) => r.id !== id)),
    adding: opts.adding,
    from: opts.now ?? Date.now(),
  });
  if (v.ok) return { ok: true };
  return { ok: false, error: eventFullMessage(opts.clanPlan, v.total), cap, total: v.total };
}

/**
 * May this event's dates change from `before` to `after` (Settings, Start now, resume, a new end)?
 *
 * Refused only when the time the event newly covers would put more players on at once than the plan
 * allows (lib/concurrentSeats windowChangeVerdict) — shortening, ending, or moving it away from the
 * others is always allowed. Says which event it would overlap and the combined count. Only when
 * FREEMIUM_ENFORCED is on.
 */
export function datesRoomVerdict(opts: {
  clanPlan: string | null | undefined;
  event: { id: number; seats: number };
  before: DatedEvent | null;
  after: DatedEvent;
  others: readonly HostEventSeats[];
  now?: number;
}): NewEventVerdict {
  if (!freemiumEnforced()) return { ok: true };
  const plan = creatorPlanOf(opts.clanPlan);
  const cap = plan.playersPerEvent;
  if (cap == null) return { ok: true };
  const others = opts.others.filter((r) => r.id !== opts.event.id);
  const v = windowChangeVerdict({
    cap,
    eventId: opts.event.id,
    seats: opts.event.seats,
    before: opts.before ? eventWindow(opts.before) : null,
    after: eventWindow(opts.after),
    others: seatWindows(others),
    from: opts.now ?? Date.now(),
  });
  if (v.ok) return { ok: true };
  const fmt = (n: number) => n.toLocaleString('en-US');
  const byId = new Map(others.map((r) => [r.id, r]));
  const names = v.others.map((id) => byId.get(id)).filter((r): r is HostEventSeats => !!r).map((r) => `${r.name} (${fmt(r.seats)})`);
  const fit = planForPlayers(v.total);
  return {
    ok: false,
    error:
      `Those dates would overlap ${joinNames(names)}: ${fmt(v.total)} players at once with this event’s ${fmt(opts.event.seats)}. ` +
      `Your ${plan.name} plan allows ${fmt(cap)} players at once across events running at the same time. ` +
      `Pick dates that don’t overlap, or ${fit.playersPerEvent == null ? 'get in touch about a Partner plan' : `upgrade to ${fit.name} for ${fmt(fit.playersPerEvent)}`}.`,
  };
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? 'your other events';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * The meter: the most players at once across the host's events from now on, which events make that
 * peak, and each current event's own count. An undated draft counts on its own (it overlaps nothing
 * until it gets dates). With nothing live, upcoming or drafted, the peak is the biggest past event, so
 * a creator between events still sees how big they run.
 */
export interface SeatMeter {
  peak: number;
  /** The events live at the peak (one, for a draft or a past event). */
  peakEvents: { name: string; players: number }[];
  /** Live, upcoming and drafted events with their own counts, biggest first. */
  events: { name: string; players: number; when: 'live' | 'upcoming' | 'draft' }[];
  /** False when nothing is live, upcoming or drafted, and `peak` is the biggest past event. */
  current: boolean;
}

export function seatMeter(rows: readonly HostEventSeats[], now = Date.now()): SeatMeter | null {
  if (rows.length === 0) return null;
  const windows = seatWindows(rows);
  const ahead = windows.filter((w) => clipInterval(w, now) != null);
  const aheadIds = new Set(ahead.map((w) => w.id));
  const drafts = rows.filter((r) => r.startDate == null && r.forceEndedAt == null);
  const byId = new Map(rows.map((r) => [r.id, r]));
  const sweep = peakConcurrentSeats(ahead, { from: now });
  const bigDraft = drafts.reduce<HostEventSeats | null>((a, b) => (!a || b.seats > a.seats ? b : a), null);

  const events = rows
    .filter((r) => aheadIds.has(r.id) || drafts.includes(r))
    .map((r) => ({
      name: r.name,
      players: r.seats,
      when: (drafts.includes(r) ? 'draft' : eventStage(r, now) === 'run' ? 'live' : 'upcoming') as SeatMeter['events'][number]['when'],
    }))
    .sort((a, b) => b.players - a.players);

  if (ahead.length === 0 && drafts.length === 0) {
    const top = rows.reduce((a, b) => (b.seats > a.seats ? b : a));
    return { peak: top.seats, peakEvents: [{ name: top.name, players: top.seats }], events: [], current: false };
  }
  if (bigDraft && bigDraft.seats > sweep.peak) {
    return { peak: bigDraft.seats, peakEvents: [{ name: bigDraft.name, players: bigDraft.seats }], events, current: true };
  }
  const peakEvents = sweep.ids.map((id) => byId.get(id)!).map((r) => ({ name: r.name, players: r.seats }));
  return { peak: sweep.peak, peakEvents, events, current: true };
}

/** Is this event full — would one more player be refused (only ever true when enforced)? */
export function eventIsFull(clanPlan: string | null | undefined, rows: readonly HostEventSeats[], eventId: number, now = Date.now()): boolean {
  const row = rows.find((r) => r.id === eventId);
  if (!row) return false;
  return !eventRoomVerdict({ clanPlan, players: row.seats, adding: 1, eventId, dates: row, others: rows, now }).ok;
}

/** Sign-up statuses that put somebody ON the board — the only ones the meter counts, on every side. */
export const ON_BOARD_STATUSES = ['pending', 'approved'] as const;

export function isOnBoardStatus(status: string | null | undefined): boolean {
  return status === 'pending' || status === 'approved';
}

/**
 * The status a selected account's sign-up row ends up with after a submission — the same rule the
 * sign-up route writes: an invite approves; a withdrawn row comes back as pending; anything else
 * (including `rejected`) keeps its status; a new row is pending, or approved through an invite.
 */
export function statusAfterSignup(prior: string | null | undefined, invite: boolean): string {
  if (prior == null) return invite ? 'approved' : 'pending';
  if (invite && prior !== 'approved') return 'approved';
  if (prior === 'withdrawn') return 'pending';
  return prior;
}

/**
 * How many board places one person's submission takes, net: their on-board rows after it, minus
 * their on-board rows before it. Deselected rows leave the board (they are withdrawn); a deselected
 * row that was not on the board (rejected, withdrawn) gives nothing back. Both sides count the same
 * statuses (ON_BOARD_STATUSES), so a rejected row cannot be traded for a place.
 */
export function signupNetAdding(opts: {
  existing: { clanMemberId: number; status: string }[];
  selectedIds: number[];
  invite: boolean;
}): number {
  const before = opts.existing.filter((r) => isOnBoardStatus(r.status)).length;
  const prior = new Map(opts.existing.map((r) => [r.clanMemberId, r.status]));
  const after = opts.selectedIds.filter((cid) => isOnBoardStatus(statusAfterSignup(prior.get(cid), opts.invite))).length;
  return after - before;
}

/** The host's upsell line for this many players at once: "Upgrade to Silver for 300 players at once." */
export function upgradeForPlayersLine(players: number): string {
  const p = planForPlayers(players + 1);
  return p.playersPerEvent == null
    ? 'Get in touch about a Partner plan for bigger events.'
    : `Upgrade to ${p.name} for ${p.playersPerEvent.toLocaleString('en-US')} players at once.`;
}

// ── Live events at once ──────────────────────────────────────────────────────────────────────────

export type NewEventVerdict = { ok: true } | { ok: false; error: string };

/**
 * May this space make another event while `liveEvents` (not yet ended) exist? Free and Bronze run one
 * at a time; Silver and up run several. Refuses only when enforced.
 */
export function newEventVerdict(opts: { clanPlan: string | null | undefined; liveEvents: number }): NewEventVerdict {
  if (creatorCan(opts.clanPlan, 'concurrent-events')) return { ok: true };
  const limit = liveEventLimit(creatorPlanOf(opts.clanPlan)) ?? Infinity;
  if (opts.liveEvents < limit) return { ok: true };
  return {
    ok: false,
    error: `Your plan runs one event at a time. End your current event first, or upgrade to ${creatorMinPlanNameFor('concurrent-events')} to run several at once.`,
  };
}

// ── Stream-platform gates ────────────────────────────────────────────────────────────────────────

/**
 * Is this gate kind a STREAM PLATFORM gate (Twitch, Kick, YouTube, whatever comes next)? Everything
 * that is not a Discord gate is — so a new platform's kinds are paid the day they are added, without
 * anyone remembering to list them here. Discord role / booster gates are free on every tier.
 */
export function isStreamGateKind(kind: string): boolean {
  return !kind.startsWith('discord-');
}

/** Do these gates ask for any stream-platform check? */
export function usesStreamGate(gates: { anyOf: { kind: string }[] } | null | undefined): boolean {
  return !!gates && gates.anyOf.some((r) => isStreamGateKind(r.kind));
}

/** The plan name a stream gate needs, when this space may not use one right now; null = allowed. */
export function streamGateLock(clanPlan: string | null | undefined): string | null {
  return creatorCan(clanPlan, 'stream-gates') ? null : creatorMinPlanNameFor('stream-gates');
}

// ── Overlay mark, !join, featured ────────────────────────────────────────────────────────────────

/** Does the OBS overlay show the small Anvil mark? Yes unless the host hid it AND may hide it. */
export function overlayShowsMark(opts: { clanPlan: string | null | undefined; hideRequested: boolean }): boolean {
  return !(opts.hideRequested && creatorCan(opts.clanPlan, 'overlay-unbranded'));
}

/** May the `!join` chat bot answer for this space? */
export function chatJoinAllowed(clanPlan: string | null | undefined): boolean {
  return creatorCan(clanPlan, 'chat-join-bot');
}

/**
 * Is this directory entry featured (listed first)? A creator space on Silver or up. Follows the plan
 * actually paid for, not the switch — see the note at the top.
 */
export function featuredListing(kind: string | null | undefined, clanPlan: string | null | undefined): boolean {
  return kind === 'creator' && creatorPlanHasCapability(creatorPlanOf(clanPlan), 'featured-listing');
}

// ── The plan card ────────────────────────────────────────────────────────────────────────────────

export interface CreatorPlanCard {
  /** "Free", "Silver", "Partner". */
  planName: string;
  /** Players at once across the host's events running at the same time. Null = no cap. */
  playersCap: number | null;
  /** Peak players at once and the events behind it (seatMeter), for the meter. */
  meter: SeatMeter | null;
  over: boolean;
  /** The tier worth showing next: the one that fits the peak, else simply the next one up. */
  next: { id: CreatorPlan['id']; name: string; priceUsd: number | null; playersCap: number | null; perks: string[] } | null;
  enforced: boolean;
}

export function creatorPlanCard(opts: { clanPlan: string | null | undefined; meter: SeatMeter | null }): CreatorPlanCard {
  const plan = creatorPlanOf(opts.clanPlan);
  const players = opts.meter?.peak ?? 0;
  const tooBig = overPlayerCap(plan.id, players);
  // "Over" is about now: a past event that ran bigger only steers which tier to suggest.
  const over = tooBig && (opts.meter?.current ?? false);
  const fits = tooBig ? planForPlayers(players) : null;
  const pick = fits && creatorPlanRank(fits) > creatorPlanRank(plan) && fits.buyable ? fits : nextCreatorPlan(plan.id);
  return {
    planName: plan.name,
    playersCap: plan.playersPerEvent,
    meter: opts.meter,
    over,
    next: pick
      ? {
          id: pick.id,
          name: pick.name,
          priceUsd: pick.priceUsd,
          playersCap: pick.playersPerEvent,
          perks: pick.perks,
        }
      : null,
    enforced: freemiumEnforced(),
  };
}
