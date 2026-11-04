// Creator-space plans — the rules. Pure: no database import (tests/pure-module-imports).
//
// A creator space (lib/creatorSpaces) is a `clans` row, so it is on a plan like any clan: the same
// Free / Bronze / Silver / Gold ladder, the same prices, the same Gumroad checkout and webhook
// (lib/plans, lib/billing). Two things differ, and this module is both of them:
//
//   THE METER is players on ONE event (`Plan.playersPerEvent`), never the roster. Every viewer who
//     ever joined a streamer's event keeps a guest seat, so a roster cap would bill a creator for
//     last year's audience. A board of 42 people is a 42-player event however many seats exist.
//   THE PERKS are streamer things: stream-platform entry gates, the `!join` chat bot, an overlay
//     without the Anvil mark, featured ordering in the directory, more than one live event at once.
//
// EVERY GATE GOES THROUGH clanCan (lib/entitlements), so while FREEMIUM_ENFORCED is off — the
// generous phase, the default — nothing here refuses anybody: a full event still seats, a Free space
// can still gate on Twitch. What the off-state DOES do is say so: the dashboard's plan card shows the
// meter and the tier that would fit, so nobody is surprised the day the switch flips.
//
// The one exception is `featuredListing`: it is a perk that only re-orders, never a door, so it
// follows the plan actually paid for, enforced or not. A Silver creator paid to be featured today.

import { clanCan, freemiumEnforced, minPlanNameFor } from '@/lib/entitlements';
import { eventStage } from '@/lib/eventStage';
import { PLANS, creatorPlanName, planHasCapability, planOf, planRank, type Plan } from '@/lib/plans';

/** The tiers a creator can buy, in order. Custom ("Partner") is set by hand, never bought. */
export const CREATOR_BUYABLE: readonly Plan[] = [PLANS.bronze, PLANS.silver, PLANS.gold];

/**
 * The plan to meter a host by, or null when nothing is metered: an ordinary clan (its roster is its
 * meter), or any host while FREEMIUM_ENFORCED is off. The race-safe writers (lib/creatorPlansDb
 * withEventRoom / withLiveEventSlot) take this and skip their lock and check on null.
 */
export function meteredPlan(clan: { kind?: string | null; plan?: string | null } | null | undefined): string | null {
  return clan && clan.kind === 'creator' && freemiumEnforced() ? (clan.plan ?? 'free') : null;
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

/** The player cap on one event for this plan string. Null = no cap. */
export function playersPerEventCap(clanPlan: string | null | undefined): number | null {
  return planOf(clanPlan).playersPerEvent;
}

/** "Players per event" as a short label: "Up to 50 players" / "No player cap". */
export function playersCapLabel(plan: Plan): string {
  return plan.playersPerEvent == null ? 'No player cap' : `Up to ${plan.playersPerEvent.toLocaleString('en-US')} players`;
}

/** How many live events at once. Null = several (no fixed number). */
export function liveEventLimit(plan: Plan): number | null {
  return planHasCapability(plan, 'concurrent-events') ? null : 1;
}

/** Is this event over (or at) what the plan would allow? Pure arithmetic — says nothing about enforcing. */
export function overPlayerCap(clanPlan: string | null | undefined, players: number): boolean {
  const cap = playersPerEventCap(clanPlan);
  return cap != null && players > cap;
}

/** The smallest buyable tier whose per-event cap holds this many players; Partner when none does. */
export function planForPlayers(players: number): Plan {
  return CREATOR_BUYABLE.find((p) => p.playersPerEvent != null && p.playersPerEvent >= players) ?? PLANS.custom;
}

/** The next buyable tier above this one, or null at Gold / Partner. */
export function nextCreatorPlan(clanPlan: string | null | undefined): Plan | null {
  const rank = planRank(planOf(clanPlan));
  return CREATOR_BUYABLE.find((p) => planRank(p) > rank) ?? null;
}

// ── Players per event ────────────────────────────────────────────────────────────────────────────

/** What a viewer reads when an event has no room. Plain: it is not their fault and not a glitch. */
export const EVENT_FULL_MESSAGE = 'This event is full. Ask the host — they can make room for more players.';

export type RoomVerdict = { ok: true } | { ok: false; error: string; cap: number };

/**
 * May `adding` more players join an event that has `players` on it now?
 *
 * Only ever refuses when FREEMIUM_ENFORCED is on. Somebody already on the board (`adding` 0, an edit)
 * is never refused, and an event already over the cap after a downgrade keeps everyone it has.
 */
export function eventRoomVerdict(opts: { clanPlan: string | null | undefined; players: number; adding: number }): RoomVerdict {
  if (!freemiumEnforced() || opts.adding <= 0) return { ok: true };
  const cap = playersPerEventCap(opts.clanPlan);
  if (cap == null || opts.players + opts.adding <= cap) return { ok: true };
  return { ok: false, error: EVENT_FULL_MESSAGE, cap };
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

/** The host's upsell line for an event of this size: "Upgrade to Silver for 300 players". */
export function upgradeForPlayersLine(players: number): string {
  const p = planForPlayers(players + 1);
  return p.playersPerEvent == null
    ? 'Get in touch about a Partner plan for bigger events.'
    : `Upgrade to ${p.name} for ${p.playersPerEvent.toLocaleString('en-US')} players.`;
}

// ── Live events at once ──────────────────────────────────────────────────────────────────────────

export type NewEventVerdict = { ok: true } | { ok: false; error: string };

/**
 * May this space make another event while `liveEvents` (not yet ended) exist? Free and Bronze run one
 * at a time; Silver and up run several. Refuses only when enforced.
 */
export function newEventVerdict(opts: { clanPlan: string | null | undefined; liveEvents: number }): NewEventVerdict {
  if (clanCan(opts.clanPlan, 'concurrent-events')) return { ok: true };
  const limit = liveEventLimit(planOf(opts.clanPlan)) ?? Infinity;
  if (opts.liveEvents < limit) return { ok: true };
  return {
    ok: false,
    error: `Your plan runs one event at a time. End your current event first, or upgrade to ${minPlanNameFor('concurrent-events')} to run several at once.`,
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
  return clanCan(clanPlan, 'stream-gates') ? null : minPlanNameFor('stream-gates');
}

// ── Overlay mark, !join, featured ────────────────────────────────────────────────────────────────

/** Does the OBS overlay show the small Anvil mark? Yes unless the host hid it AND may hide it. */
export function overlayShowsMark(opts: { clanPlan: string | null | undefined; hideRequested: boolean }): boolean {
  return !(opts.hideRequested && clanCan(opts.clanPlan, 'overlay-unbranded'));
}

/** May the `!join` chat bot answer for this space? */
export function chatJoinAllowed(clanPlan: string | null | undefined): boolean {
  return clanCan(clanPlan, 'chat-join-bot');
}

/**
 * Is this directory entry featured (listed first)? A creator space on Silver or up. Follows the plan
 * actually paid for, not the switch — see the note at the top.
 */
export function featuredListing(kind: string | null | undefined, clanPlan: string | null | undefined): boolean {
  return kind === 'creator' && planHasCapability(planOf(clanPlan), 'featured-listing');
}

// ── The plan card ────────────────────────────────────────────────────────────────────────────────

export interface CreatorPlanCard {
  /** "Free", "Silver", "Partner". */
  planName: string;
  playersCap: number | null;
  /** The biggest event that is not over yet (or the biggest ever, when none is live), for the meter. */
  biggest: { name: string; players: number } | null;
  over: boolean;
  /** The tier worth showing next: the one that fits the biggest event, else simply the next one up. */
  next: { id: Plan['id']; name: string; priceUsd: number | null; playersCap: number | null; perks: string[] } | null;
  enforced: boolean;
}

/** Plain-words perks a tier adds over the one below, for the card. */
export const CREATOR_PERKS: Record<'bronze' | 'silver' | 'gold', string[]> = {
  bronze: ['Only Twitch followers or subs can join'],
  silver: ['Run more than one event at a time', '!join in your Twitch chat', 'Shown first in the clans list'],
  gold: ['Hide the Anvil mark on your OBS overlay'],
};

export function creatorPlanCard(opts: { clanPlan: string | null | undefined; biggest: { name: string; players: number } | null }): CreatorPlanCard {
  const plan = planOf(opts.clanPlan);
  const players = opts.biggest?.players ?? 0;
  const over = overPlayerCap(plan.id, players);
  const fits = over ? planForPlayers(players) : null;
  const pick = fits && planRank(fits) > planRank(plan) && fits.id !== 'custom' ? fits : nextCreatorPlan(plan.id);
  return {
    planName: creatorPlanName(plan),
    playersCap: plan.playersPerEvent,
    biggest: opts.biggest,
    over,
    next: pick
      ? {
          id: pick.id,
          name: pick.name,
          priceUsd: pick.priceUsd,
          playersCap: pick.playersPerEvent,
          perks: CREATOR_PERKS[pick.id as 'bronze' | 'silver' | 'gold'] ?? [],
        }
      : null,
    enforced: freemiumEnforced(),
  };
}
