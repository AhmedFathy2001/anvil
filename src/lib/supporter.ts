// Anvil Supporter: reading a person's supporter state, and their checkout link.
//
// The subscription belongs to the LOGIN (users.id), like the plugin token, so it follows the person
// into every clan and onto their apex profile. Tiers and the pure state logic live in
// lib/supporterTiers; this is the database half. The webhook side is lib/supporterBilling.

import { and, eq, inArray, isNotNull } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, supporterSubscriptions, users } from '@/db/schema';
import { normalizeRsn } from '@/lib/auth';
import { newCheckoutRef } from '@/lib/billing';
import { hasChatStar } from '@/lib/chatLook';
import { supporterInk, type SupporterInk, type SupporterLook } from '@/lib/supporterStyle';
import { SUPPORTER_TIERS, rowInForce, supporterState, tiersByName, type SupporterState, type SupporterTierId } from '@/lib/supporterTiers';

export * from '@/lib/supporterTiers';
export * from '@/lib/supporterStyle';

const ROW_COLUMNS = {
  userId: supporterSubscriptions.userId,
  tier: supporterSubscriptions.tier,
  status: supporterSubscriptions.status,
  currentPeriodEnd: supporterSubscriptions.currentPeriodEnd,
  startedAt: supporterSubscriptions.startedAt,
  recurrence: supporterSubscriptions.recurrence,
  // The owning login's name colours ride along on the same read (every lookup joins users).
  style: users.supporterStyle,
} as const;

/** One person's supporter state, or null when they are not supporting right now. */
export async function supporterForUser(userId: number): Promise<SupporterState | null> {
  const rows = await db
    .select(ROW_COLUMNS)
    .from(supporterSubscriptions)
    .innerJoin(users, eq(users.id, supporterSubscriptions.userId))
    .where(eq(supporterSubscriptions.userId, userId));
  return supporterState(rows);
}

/**
 * The Gumroad membership behind a person's Supporter tier, for "Manage on Gumroad": the in-force row
 * that gives them their tier (best rank first) that has a subscription id. Null for a gift or invite
 * reward (nothing to manage) and for someone not supporting.
 */
export async function supporterSubscriptionIdForUser(userId: number, now = Date.now()): Promise<string | null> {
  const rows = await db
    .select({
      tier: supporterSubscriptions.tier,
      status: supporterSubscriptions.status,
      currentPeriodEnd: supporterSubscriptions.currentPeriodEnd,
      startedAt: supporterSubscriptions.startedAt,
      subscriptionId: supporterSubscriptions.gumroadSubscriptionId,
    })
    .from(supporterSubscriptions)
    .where(eq(supporterSubscriptions.userId, userId));
  const paid = rows
    .filter((r) => r.subscriptionId && rowInForce(r, now))
    .sort((a, b) => SUPPORTER_TIERS[b.tier as SupporterTierId].rank - SUPPORTER_TIERS[a.tier as SupporterTierId].rank);
  return paid[0]?.subscriptionId ?? null;
}

/** Many people at once (a leaderboard, a roster): only supporters appear in the map. */
export async function supporterForUsers(userIds: number[]): Promise<Map<number, SupporterState>> {
  const out = new Map<number, SupporterState>();
  const ids = [...new Set(userIds)].filter((n) => Number.isInteger(n) && n > 0);
  if (ids.length === 0) return out;
  const rows = await db
    .select(ROW_COLUMNS)
    .from(supporterSubscriptions)
    .innerJoin(users, eq(users.id, supporterSubscriptions.userId))
    .where(inArray(supporterSubscriptions.userId, ids));
  const byUser = new Map<number, typeof rows>();
  for (const r of rows) byUser.set(r.userId, [...(byUser.get(r.userId) ?? []), r]);
  for (const [id, list] of byUser) {
    const state = supporterState(list);
    if (state) out.set(id, state);
  }
  return out;
}

/**
 * A PERSON's supporter state (players.id), for public pages that know the person but not the login.
 * Every login of theirs counts; the best tier in force wins.
 */
export async function supporterForPlayer(playerId: number): Promise<SupporterState | null> {
  const rows = await db
    .select(ROW_COLUMNS)
    .from(supporterSubscriptions)
    .innerJoin(users, eq(users.id, supporterSubscriptions.userId))
    .where(eq(users.playerId, playerId));
  return supporterState(rows);
}

/**
 * Supporter tiers by character name, for lists drawn from names (the plugin panel's rosters and
 * cards). Keyed by `normalizeRsn`; only supporters appear. One query however long the list.
 */
export async function supporterTiersForRsns(rsns: string[]): Promise<Map<string, SupporterTierId>> {
  const out = new Map<string, SupporterTierId>();
  for (const [rsn, state] of await supporterStatesForRsns(rsns)) out.set(rsn, state.tier.id);
  return out;
}

async function supporterStatesForRsns(rsns: string[]): Promise<Map<string, SupporterState>> {
  const out = new Map<string, SupporterState>();
  const keys = [...new Set(rsns.map(normalizeRsn))].filter((k) => k.length > 0 && k.length <= 12).slice(0, 500);
  if (keys.length === 0) return out;
  const rows = await db
    .select({ rsn: accounts.rsnNormalized, ...ROW_COLUMNS })
    .from(accounts)
    .innerJoin(users, eq(users.playerId, accounts.playerId))
    .innerJoin(supporterSubscriptions, eq(supporterSubscriptions.userId, users.id))
    .where(inArray(accounts.rsnNormalized, keys));
  const byRsn = new Map<string, typeof rows>();
  for (const r of rows) byRsn.set(r.rsn, [...(byRsn.get(r.rsn) ?? []), r]);
  for (const [rsn, list] of byRsn) {
    const state = supporterState(list);
    if (state) out.set(rsn, state);
  }
  return out;
}

/**
 * supporterTiersForRsns with each name's colours as worn (tier plus their gated style): what the
 * plugin panel paints. Same single query.
 */
export async function supporterInksForRsns(rsns: string[]): Promise<Map<string, SupporterInk & { label: string }>> {
  const out = new Map<string, SupporterInk & { label: string }>();
  for (const [rsn, state] of await supporterStatesForRsns(rsns)) {
    // The tier rides along for the star's tooltip in the panel.
    out.set(rsn, { ...supporterInk(state.tier.id, state.style), label: `Anvil ${state.tier.name}` });
  }
  return out;
}

/**
 * Each name's supporter look (tier and their gated colours), keyed by the names as given, for a page
 * handing a list to the browser. The look rides on the CHARACTER's name only — never the person or
 * their other characters — the same as the plugin panel's flair. One query; flair is decoration, so
 * a failed read is no flair, never a broken page.
 */
export async function supporterLooksByName(names: string[]): Promise<Record<string, SupporterLook>> {
  const states = await supporterStatesForRsns(names).catch(() => new Map<string, SupporterState>());
  const looks = new Map<string, SupporterLook>();
  for (const [rsn, state] of states) looks.set(rsn, { tier: state.tier.id, style: state.style });
  return tiersByName(names, looks, normalizeRsn);
}

/** supporterLooksByName, tiers only. */
export async function supporterTiersByName(names: string[]): Promise<Record<string, SupporterTierId>> {
  const tiers = await supporterTiersForRsns(names).catch(() => new Map<string, SupporterTierId>());
  return tiersByName(names, tiers, normalizeRsn);
}

/** The person's Supporter checkout ref, creating one on first use. Stable for the life of the login. */
export async function ensureSupporterRef(userId: number): Promise<string> {
  const row = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { supporterRef: true } });
  if (row?.supporterRef) return row.supporterRef;
  const ref = newCheckoutRef();
  await db.update(users).set({ supporterRef: ref }).where(eq(users.id, userId));
  return ref;
}

/**
 * The hosted Gumroad checkout for Supporter, carrying the buyer's ref so the sale finds them. Null
 * when the product is not configured on this deployment (the page then hides the buy buttons).
 */
export function supporterCheckoutUrl(ref: string, via?: string | null): string | null {
  const base = process.env.GUMROAD_URL_SUPPORTER;
  if (!base) return null;
  const url = new URL(base);
  url.searchParams.set('ref', ref);
  // Whose invite brought them (lib/referrals); Gumroad echoes it back on the sale.
  if (via) url.searchParams.set('via', via);
  return url.toString();
}

/** One character's flair in normal game chat: its name (normalized), colour, gradient and star. */
export interface GameChatFlair {
  n: string;
  c: string;
  g?: string[];
  s?: true;
}

/**
 * Every Supporter's characters with the look they wear, for the plugin to paint on names in normal
 * game chat. Only people who left `game_chat_flair` on, and only characters they share publicly (a
 * hidden character's name must not be tied to them), and only ones they have proven are theirs. Lapsed and refunded rows drop out on their own.
 */
export async function gameChatFlair(): Promise<GameChatFlair[]> {
  const subs = await db
    .select(ROW_COLUMNS)
    .from(supporterSubscriptions)
    .innerJoin(users, eq(users.id, supporterSubscriptions.userId))
    .where(and(eq(users.gameChatFlair, true), isNotNull(users.playerId)));
  const byUser = new Map<number, typeof subs>();
  for (const r of subs) byUser.set(r.userId, [...(byUser.get(r.userId) ?? []), r]);
  const states = new Map<number, SupporterState>();
  for (const [id, list] of byUser) {
    const state = supporterState(list);
    if (state) states.set(id, state);
  }
  if (states.size === 0) return [];

  const chars = await db
    .select({ userId: users.id, rsn: accounts.rsnNormalized })
    .from(users)
    .innerJoin(accounts, eq(accounts.playerId, users.playerId))
    .where(
      and(
        inArray(users.id, [...states.keys()]),
        eq(accounts.shared, true),
        // Proven theirs only: flair on a name someone merely typed in would paint a stranger.
        isNotNull(accounts.verifiedAt),
        eq(accounts.provisional, 0),
      ),
    );
  const out = new Map<string, GameChatFlair>();
  for (const { userId, rsn } of chars) {
    const state = states.get(userId);
    if (!state || !rsn || rsn.length > 12) continue;
    const prev = out.get(rsn);
    // Two logins on one character (rare): the higher tier wins.
    if (prev && (prev.s || !hasChatStar(state.tier.id))) continue;
    const ink = supporterInk(state.tier.id, state.style);
    out.set(rsn, {
      n: rsn,
      c: ink.color,
      ...(ink.grad && ink.grad.length >= 2 ? { g: ink.grad.slice(0, 4) } : {}),
      ...(hasChatStar(state.tier.id) ? { s: true as const } : {}),
    });
  }
  return [...out.values()].sort((a, b) => a.n.localeCompare(b.n));
}

