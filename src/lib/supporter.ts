// Anvil Supporter: reading a person's supporter state, and their checkout link.
//
// The subscription belongs to the LOGIN (users.id), like the plugin token, so it follows the person
// into every clan and onto their apex profile. Tiers and the pure state logic live in
// lib/supporterTiers; this is the database half. The webhook side is lib/supporterBilling.

import { eq, inArray } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, supporterSubscriptions, users } from '@/db/schema';
import { normalizeRsn } from '@/lib/auth';
import { newCheckoutRef } from '@/lib/billing';
import { supporterInk, type SupporterInk } from '@/lib/supporterStyle';
import { supporterState, type SupporterState, type SupporterTierId } from '@/lib/supporterTiers';

export * from '@/lib/supporterTiers';
export * from '@/lib/supporterStyle';

const ROW_COLUMNS = {
  userId: supporterSubscriptions.userId,
  tier: supporterSubscriptions.tier,
  status: supporterSubscriptions.status,
  currentPeriodEnd: supporterSubscriptions.currentPeriodEnd,
  startedAt: supporterSubscriptions.startedAt,
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
export async function supporterInksForRsns(rsns: string[]): Promise<Map<string, SupporterInk>> {
  const out = new Map<string, SupporterInk>();
  for (const [rsn, state] of await supporterStatesForRsns(rsns)) out.set(rsn, supporterInk(state.tier.id, state.style));
  return out;
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
