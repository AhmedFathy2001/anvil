// The staff inbox of Gumroad purchases nothing matched (unmatched_purchases, drizzle/0228).
//
// Recording is BEST-EFFORT by construction: it runs inside the billing webhook, whose answers to
// Gumroad must not change because a side table could not be written. Every write here swallows its
// own error and logs it.
//
// What staff then do with a row — attach it or dismiss it — lives in lib/unmatchedPurchaseActions,
// apart from this, so the webhook's import graph does not grow the attach machinery.

import { and, desc, eq, inArray, ne, or, sql } from 'drizzle-orm';

import { db } from '@/db';
import { clans, unmatchedPurchases, users } from '@/db/schema';
import type { GumroadEvent } from '@/lib/gumroad';
import { log } from '@/lib/logger';
import { gumroadStateAfter, unmatchedRowFromEvent, type UnmatchedKind, type UnmatchedReason } from '@/lib/unmatchedPurchaseRules';

/**
 * Keep a purchase the webhook could not place.
 *
 *   - A SALE becomes a row, once: the sale id is unique, so Gumroad retrying the same notification
 *     changes nothing (the first row is kept as it was).
 *   - Anything else (a renewal, cancel, end, refund, dispute, restart) is about a membership already
 *     sold: it moves gumroad_state on that subscription's OPEN row, if there is one, and never adds a
 *     row — a notification about a membership somebody already cancelled is not a new purchase.
 */
export async function recordUnmatchedPurchase(
  ev: GumroadEvent,
  opts: { kind: UnmatchedKind; reason: UnmatchedReason; refClanId?: number | null },
): Promise<void> {
  try {
    if (ev.kind === 'sale') {
      // A clan's checkout ref names the clan; keep which one, when the caller did not already know.
      let refClanId = opts.refClanId ?? null;
      if (refClanId == null && opts.kind !== 'supporter' && ev.urlParams?.ref) {
        const byRef = await db.query.clans.findFirst({ where: eq(clans.gumroadRef, ev.urlParams.ref), columns: { id: true } });
        refClanId = byRef?.id ?? null;
      }
      await db
        .insert(unmatchedPurchases)
        .values(unmatchedRowFromEvent(ev, { ...opts, refClanId }))
        .onConflictDoNothing({ target: unmatchedPurchases.gumroadSaleId });
      return;
    }
    await noteUnmatchedFollowUp(ev);
  } catch (err) {
    log.warn('unmatched.record-failed', { kind: ev.kind, sale: ev.saleId, subscription: ev.subscriptionId, error: String(err) });
  }
}

/**
 * A later notification for a membership that is sitting in the inbox: its open row learns what
 * happened (renewed, cancelled, refunded…). Matched by subscription id, else (a refund of a one-off)
 * by sale id. Rows already attached or dismissed are left as staff resolved them. Best-effort.
 */
export async function noteUnmatchedFollowUp(ev: GumroadEvent): Promise<void> {
  try {
    const state = gumroadStateAfter(ev.kind);
    if (!state) return;
    const match = ev.subscriptionId
      ? eq(unmatchedPurchases.gumroadSubscriptionId, ev.subscriptionId)
      : ev.saleId
        ? eq(unmatchedPurchases.gumroadSaleId, ev.saleId)
        : null;
    if (!match) return;
    await db
      .update(unmatchedPurchases)
      .set({ gumroadState: state, lastEventAt: sql`now()` })
      .where(and(match, eq(unmatchedPurchases.status, 'open')));
  } catch (err) {
    log.warn('unmatched.follow-up-failed', { kind: ev.kind, subscription: ev.subscriptionId, error: String(err) });
  }
}

export interface UnmatchedPurchaseRow {
  id: number;
  receivedAt: string;
  kind: string;
  reason: string;
  gumroadSaleId: string | null;
  gumroadSubscriptionId: string | null;
  productId: string | null;
  productName: string | null;
  productPermalink: string | null;
  tier: string | null;
  planId: string | null;
  recurrence: string | null;
  priceCents: number | null;
  currency: string | null;
  buyerEmail: string | null;
  ref: string | null;
  gumroadState: string;
  lastEventAt: string | null;
  status: string;
  resolvedAt: string | null;
  resolutionNote: string | null;
  refClan: { id: number; name: string; slug: string; kind: string } | null;
  attachedClan: { id: number; name: string; slug: string } | null;
  attachedUser: { id: number; name: string } | null;
  resolvedBy: string | null;
}

const iso = (d: Date | string | null): string | null => (d == null ? null : d instanceof Date ? d.toISOString() : String(d));

/** The inbox: every open row (oldest first — the longest-waiting customer on top), then the latest resolved. */
export async function listUnmatchedPurchases(resolvedLimit = 20): Promise<{ open: UnmatchedPurchaseRow[]; resolved: UnmatchedPurchaseRow[] }> {
  // clan-scope: global -- platform billing, staff only.
  const base = db.select().from(unmatchedPurchases);
  const [open, resolved] = await Promise.all([
    base.where(eq(unmatchedPurchases.status, 'open')).orderBy(unmatchedPurchases.receivedAt).limit(200),
    db
      .select()
      .from(unmatchedPurchases)
      .where(ne(unmatchedPurchases.status, 'open'))
      .orderBy(desc(unmatchedPurchases.resolvedAt))
      .limit(resolvedLimit),
  ]);
  const all = [...open, ...resolved];
  const clanIds = [...new Set(all.flatMap((r) => [r.refClanId, r.attachedClanId]).filter((v): v is number => v != null))];
  const userIds = [...new Set(all.flatMap((r) => [r.attachedUserId, r.resolvedByUserId]).filter((v): v is number => v != null))];
  const [clanRows, userRows] = await Promise.all([
    clanIds.length
      ? db.select({ id: clans.id, name: clans.name, slug: clans.slug, kind: clans.kind }).from(clans).where(inArray(clans.id, clanIds))
      : [],
    userIds.length
      ? db.select({ id: users.id, name: users.displayName, discordUsername: users.discordUsername }).from(users).where(inArray(users.id, userIds))
      : [],
  ]);
  const clanById = new Map(clanRows.map((c) => [c.id, c]));
  const userById = new Map(userRows.map((u) => [u.id, u]));
  const shape = (r: (typeof all)[number]): UnmatchedPurchaseRow => {
    const ac = r.attachedClanId != null ? clanById.get(r.attachedClanId) : undefined;
    const au = r.attachedUserId != null ? userById.get(r.attachedUserId) : undefined;
    const by = r.resolvedByUserId != null ? userById.get(r.resolvedByUserId) : undefined;
    return {
      id: r.id,
      receivedAt: iso(r.receivedAt) ?? '',
      kind: r.kind,
      reason: r.reason,
      gumroadSaleId: r.gumroadSaleId,
      gumroadSubscriptionId: r.gumroadSubscriptionId,
      productId: r.productId,
      productName: r.productName,
      productPermalink: r.productPermalink,
      tier: r.tier,
      planId: r.planId,
      recurrence: r.recurrence,
      priceCents: r.priceCents,
      currency: r.currency,
      buyerEmail: r.buyerEmail,
      ref: r.ref,
      gumroadState: r.gumroadState,
      lastEventAt: iso(r.lastEventAt),
      status: r.status,
      resolvedAt: iso(r.resolvedAt),
      resolutionNote: r.resolutionNote,
      refClan: r.refClanId != null ? (clanById.get(r.refClanId) ?? null) : null,
      attachedClan: ac ? { id: ac.id, name: ac.name, slug: ac.slug } : null,
      attachedUser: au ? { id: au.id, name: au.name ?? au.discordUsername ?? `User ${au.id}` } : null,
      resolvedBy: by ? (by.name ?? by.discordUsername ?? `User ${by.id}`) : null,
    };
  };
  return { open: open.map(shape), resolved: resolved.map(shape) };
}

/** Staff picker: spaces by slug or name (both kinds; the attach checks the kind). */
export async function searchAttachSpaces(q: string, limit = 10) {
  const term = q.trim().toLowerCase();
  if (!term) return [];
  const like = `%${term}%`;
  const asId = /^\d{1,9}$/.test(term) ? Number(term) : null;
  // clan-scope: global -- staff picking which space a purchase belongs to.
  return db
    .select({
      id: clans.id,
      name: clans.name,
      slug: clans.slug,
      kind: clans.kind,
      plan: clans.plan,
      status: clans.status,
      gumroadSubscriptionId: clans.gumroadSubscriptionId,
    })
    .from(clans)
    .where(
      or(
        sql`lower(${clans.slug}) like ${like}`,
        sql`lower(${clans.name}) like ${like}`,
        asId != null ? eq(clans.id, asId) : sql`false`,
      ),
    )
    .orderBy(sql`case when lower(${clans.slug}) = ${term} then 0 else 1 end`, clans.name)
    .limit(limit);
}

/** Staff picker: logins by Discord name, display name, Discord id or login id. */
export async function searchAttachUsers(q: string, limit = 10) {
  const term = q.trim().replace(/^@/, '');
  if (!term) return [];
  const like = `%${term.toLowerCase()}%`;
  const asId = /^\d{1,9}$/.test(term) ? Number(term) : null;
  return db
    .select({ id: users.id, displayName: users.displayName, discordUsername: users.discordUsername, discordId: users.discordId })
    .from(users)
    .where(
      or(
        sql`lower(${users.discordUsername}) like ${like}`,
        sql`lower(${users.displayName}) like ${like}`,
        eq(users.discordId, term),
        asId != null ? eq(users.id, asId) : sql`false`,
      ),
    )
    .orderBy(sql`case when lower(coalesce(${users.discordUsername}, '')) = ${term.toLowerCase()} then 0 else 1 end`, users.displayName)
    .limit(limit);
}
