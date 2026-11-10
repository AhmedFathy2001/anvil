// Paid Supporter gifts, the database half (the rules are lib/supporterGiftPurchase).
//
//   1. The buyer names a character on anvilosrs.com. It must be shared publicly (a hidden
//      character is never confirmed to exist) and its person must have a login to receive it.
//   2. createGiftIntent stores an opaque token naming buyer and recipient, and hands back the
//      Gumroad checkout with `gift=<token>` and the buyer's own `ref`.
//   3. The sale comes back through the webhook: handleGiftEvent turns it into a granted row on the
//      recipient's login for the months bought, once per sale. A refund takes it back.

import { randomBytes } from 'node:crypto';
import { and, asc, desc, eq, inArray, isNotNull, ne, sql } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, supporterGiftIntents, supporterSubscriptions, users } from '@/db/schema';
import { normalizeRsn } from '@/lib/auth';
import { afterSupporterChange } from '@/lib/anvilDiscord';
import { checkSaleWithGumroad, type GumroadEvent } from '@/lib/gumroad';
import { ensureSupporterRef, flairCharacterWhere } from '@/lib/supporter';
import { GIFT_OPTIONS, PAID_GIFT_RECURRENCE, giftBlocked, giftOptionName, giftStartsAt, giverRank, parseGiftOption, type GiftLength, type GiverRank } from '@/lib/supporterGiftPurchase';
import { ttlMemo } from '@/lib/ttlMemo';
import { recordUnmatchedPurchase } from '@/lib/unmatchedPurchases';
import { announceGift } from '@/lib/supporterMoments';
import { SUPPORTER_TIERS, type SupporterTierId } from '@/lib/supporterTiers';

type Result = { status: number; body: Record<string, unknown> };
const ok = (body: Record<string, unknown> = {}): Result => ({ status: 200, body: { received: true, ...body } });

/** Is this notification about the one-time gift product? */
export function isSupporterGiftEvent(ev: Pick<GumroadEvent, 'productId' | 'productPermalink'>): boolean {
  const id = process.env.GUMROAD_PRODUCT_SUPPORTER_GIFT;
  if (id && ev.productId === id) return true;
  const permalink = process.env.GUMROAD_PERMALINK_SUPPORTER_GIFT || 'supporter-gift';
  return !!ev.productPermalink && ev.productPermalink === permalink;
}

export const giftCheckoutConfigured = () => !!process.env.GUMROAD_URL_SUPPORTER_GIFT;

export type GiftRecipient = { userId: number; playerId: number; name: string };

/** Who a gift for this character name would go to, or why not. */
export async function giftRecipient(rsn: string, buyerUserId: number): Promise<GiftRecipient | { error: string }> {
  const key = normalizeRsn(rsn);
  if (!key || key.length > 12) return { error: 'Type their in-game name.' };
  const [char] = await db
    .select({ playerId: accounts.playerId, name: accounts.rsn })
    .from(accounts)
    .where(and(eq(accounts.rsnNormalized, key), isNotNull(accounts.playerId), flairCharacterWhere()))
    .limit(1);
  // Same answer for "no such name" and "a name they keep private": a gift never confirms either.
  if (!char?.playerId) return { error: 'Nobody on Anvil shares that name publicly.' };
  const [login] = await db
    .select({ id: users.id, playerId: users.playerId })
    .from(users)
    .where(and(eq(users.playerId, char.playerId), eq(users.banned, false)))
    .orderBy(asc(users.id))
    .limit(1);
  if (!login) return { error: 'They haven’t signed in to Anvil yet, so there’s nowhere to put it.' };
  const buyer = await db.query.users.findFirst({ where: eq(users.id, buyerUserId), columns: { playerId: true } });
  if (buyer?.playerId != null && buyer.playerId === char.playerId) return { error: 'That’s you. Pick a tier above to support for yourself.' };
  return { userId: login.id, playerId: char.playerId, name: char.name };
}

/** Everything the recipient holds or is owed, across all their logins (giftBlocked / giftStartsAt read it). */
async function recipientRows(userId: number) {
  const login = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { playerId: true } });
  return db
    .select({ tier: supporterSubscriptions.tier, status: supporterSubscriptions.status, recurrence: supporterSubscriptions.recurrence, currentPeriodEnd: supporterSubscriptions.currentPeriodEnd })
    .from(supporterSubscriptions)
    .innerJoin(users, eq(users.id, supporterSubscriptions.userId))
    .where(login?.playerId != null ? eq(users.playerId, login.playerId) : eq(users.id, userId));
}

/** Each option on sale for this recipient: its price, and why it can't be bought for them (or null). */
export async function giftOptionsFor(recipient: GiftRecipient): Promise<{ tier: SupporterTierId; months: GiftLength; name: string; usd: number; blocked: string | null }[]> {
  const rows = await recipientRows(recipient.userId);
  return GIFT_OPTIONS.map((o) => ({ ...o, blocked: giftBlocked(rows, o.tier) }));
}

/**
 * The Gumroad id of each option, by name, read from the product's own variants (cached an hour), so
 * the checkout opens on the option picked here. Empty when Gumroad can't be asked: the sale is still
 * checked against the choice.
 */
function giftOptionIds(): Promise<Map<string, string>> {
  return ttlMemo('gift-option-ids', async () => {
    const token = process.env.GUMROAD_ACCESS_TOKEN;
    const product = process.env.GUMROAD_PRODUCT_SUPPORTER_GIFT;
    const out = new Map<string, string>();
    if (!token || !product) return out;
    const api = (path: string) =>
      fetch(`https://api.gumroad.com/v2/products/${encodeURIComponent(product)}${path}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8_000) })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null) as Promise<Record<string, unknown> | null>;
    const cats = (await api('/variant_categories'))?.variant_categories as { id: string }[] | undefined;
    for (const c of cats ?? []) {
      const vs = (await api(`/variant_categories/${encodeURIComponent(c.id)}/variants`))?.variants as { id: string; name: string }[] | undefined;
      for (const v of vs ?? []) out.set(v.name, v.id);
    }
    return out;
  }, 60 * 60_000);
}

/** The checkout for a gift of `tier` for `months` to `recipient`, paid by `buyerUserId`; or why not. */
export async function createGiftIntent(
  buyerUserId: number,
  recipient: GiftRecipient,
  tier: SupporterTierId,
  months: GiftLength,
): Promise<{ url: string } | { error: string } | null> {
  const base = process.env.GUMROAD_URL_SUPPORTER_GIFT;
  if (!base) return null;
  const blocked = giftBlocked(await recipientRows(recipient.userId), tier);
  if (blocked) return { error: blocked };
  const token = randomBytes(18).toString('base64url');
  await db.insert(supporterGiftIntents).values({ token, buyerUserId, recipientUserId: recipient.userId, tier, months });
  const url = new URL(base);
  url.searchParams.set('gift', token);
  url.searchParams.set('ref', await ensureSupporterRef(buyerUserId));
  const option = (await giftOptionIds().catch(() => new Map<string, string>())).get(giftOptionName(tier, months));
  if (option) url.searchParams.set('option', option);
  return { url: url.toString() };
}

/** Apply one gift-product notification. */
export async function handleGiftEvent(ev: GumroadEvent): Promise<Result> {
  const row = ev.saleId
    ? await db.query.supporterSubscriptions.findFirst({ where: eq(supporterSubscriptions.gumroadSaleId, ev.saleId) })
    : undefined;

  if (ev.kind === 'refund' || ev.kind === 'dispute') {
    if (!row) return ok({ note: 'unknown gift' });
    await db.update(supporterSubscriptions).set({ status: 'refunded', endedAt: new Date().toISOString() }).where(eq(supporterSubscriptions.id, row.id));
    afterSupporterChange(row.userId);
    return ok({ note: 'gift refunded' });
  }
  if (ev.kind !== 'sale') return ok({ note: 'nothing to do for a one-time gift' });
  // No sale id: nothing to check, latch or refund later. Never granted.
  if (!ev.saleId) return ok({ note: 'gift sale without an id' });
  if (row) return ok({ note: 'already applied' });

  const option = parseGiftOption(ev.tier);
  // Gumroad is asked about the sale AND that it was this tier and length, so a body can't upgrade it.
  const check = await checkSaleWithGumroad(ev.saleId, ev.productId, option ? giftOptionName(option.tier, option.months) : null);
  if (check === 'error') return { status: 503, body: { error: 'Could not confirm the sale with Gumroad' } };
  if (check === 'rejected') return ok({ note: 'sale not confirmed by Gumroad' });

  const intent = ev.urlParams.gift
    ? await db.query.supporterGiftIntents.findFirst({ where: eq(supporterGiftIntents.token, ev.urlParams.gift) })
    : undefined;
  // Bought something other than what was picked here (the option is changeable on Gumroad): held, so a
  // blocked choice can't sneak through.
  const mismatch = !!intent?.tier && (!option || option.tier !== intent.tier || option.months !== intent.months);
  if (!option || !intent || intent.usedSaleId || mismatch) {
    console.warn('[supporter-gift] cannot apply', { sale: ev.saleId, option: ev.tier, intent: !!intent, used: intent?.usedSaleId ?? null });
    await recordUnmatchedPurchase(ev, { kind: 'supporter', reason: 'no-buyer' }).catch(() => {});
    return ok({ note: 'gift held for staff' });
  }

  // On top of time already granted to them at this tier or above, it starts when that runs out.
  const start = new Date(giftStartsAt(await recipientRows(intent.recipientUserId), option.tier));
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + option.months);
  const created = await db.transaction(async (tx) => {
    // Claim the intent first: a replay racing this one finds it used and stops.
    const claimed = await tx
      .update(supporterGiftIntents)
      .set({ usedSaleId: ev.saleId })
      .where(and(eq(supporterGiftIntents.token, intent.token), sql`${supporterGiftIntents.usedSaleId} IS NULL`))
      .returning({ token: supporterGiftIntents.token });
    if (claimed.length === 0) return null;
    const [r] = await tx
      .insert(supporterSubscriptions)
      .values({
        userId: intent.recipientUserId,
        tier: option.tier,
        status: 'granted',
        recurrence: PAID_GIFT_RECURRENCE,
        gumroadSaleId: ev.saleId,
        startedAt: start.toISOString(),
        currentPeriodEnd: end.toISOString(),
        giftedByUserId: intent.buyerUserId,
        giftMonths: option.months,
      })
      .returning({ id: supporterSubscriptions.id });
    return r ?? null;
  });
  if (!created) return ok({ note: 'already applied' });
  afterSupporterChange([intent.recipientUserId, intent.buyerUserId]);
  // "X gifted Y 3 months" in their shared clans and the Anvil Discord. Not awaited; never throws.
  void announceGift(ev.saleId, intent.buyerUserId, intent.recipientUserId, option.months, SUPPORTER_TIERS[option.tier].name);
  return ok({ gift: option });
}

/** Months each person has bought for others (refunds excluded), keyed by the logins asked about. */
export async function giftedMonthsFor(userIds: number[]): Promise<Map<number, number>> {
  const out = new Map<number, number>();
  const ids = [...new Set(userIds)].filter((n) => Number.isInteger(n) && n > 0);
  if (ids.length === 0) return out;
  const rows = await db
    .select({ by: supporterSubscriptions.giftedByUserId, months: sql<number>`coalesce(sum(${supporterSubscriptions.giftMonths}), 0)::int` })
    .from(supporterSubscriptions)
    .where(and(inArray(supporterSubscriptions.giftedByUserId, ids), ne(supporterSubscriptions.status, 'refunded')))
    .groupBy(supporterSubscriptions.giftedByUserId);
  for (const r of rows) if (r.by != null) out.set(r.by, Number(r.months));
  return out;
}

export interface TopGiver {
  name: string;
  months: number;
  people: number;
  rank: GiverRank | null;
}

/**
 * The biggest givers since `sinceIso`, by months given, each under one public character (the same
 * rule as the wall: a person with none, or off the wall, isn't named).
 */
export async function topGivers(sinceIso: string, limit = 5): Promise<TopGiver[]> {
  const rows = await db
    .select({
      playerId: users.playerId,
      months: sql<number>`coalesce(sum(${supporterSubscriptions.giftMonths}), 0)::int`,
      people: sql<number>`count(distinct ${supporterSubscriptions.userId})::int`,
    })
    .from(supporterSubscriptions)
    .innerJoin(users, eq(users.id, supporterSubscriptions.giftedByUserId))
    .where(
      and(
        isNotNull(supporterSubscriptions.giftedByUserId),
        ne(supporterSubscriptions.status, 'refunded'),
        sql`${supporterSubscriptions.startedAt} >= ${sinceIso}`,
        isNotNull(users.playerId),
      ),
    )
    .groupBy(users.playerId)
    .orderBy(desc(sql`sum(${supporterSubscriptions.giftMonths})`))
    .limit(limit * 3);
  const pids = rows.map((r) => r.playerId!).filter((p) => p != null);
  if (pids.length === 0) return [];
  const hidden = new Set(
    (await db.select({ p: users.playerId }).from(users).where(and(inArray(users.playerId, pids), eq(users.supporterWall, false)))).map((r) => r.p),
  );
  const chars = await db
    .select({ playerId: accounts.playerId, rsn: accounts.rsn })
    .from(accounts)
    .where(and(inArray(accounts.playerId, pids), flairCharacterWhere()));
  const nameOf = new Map<number, string>();
  for (const c of chars.sort((a, b) => a.rsn.localeCompare(b.rsn))) if (c.playerId != null && !nameOf.has(c.playerId)) nameOf.set(c.playerId, c.rsn);
  const out: TopGiver[] = [];
  for (const r of rows) {
    const name = r.playerId != null && !hidden.has(r.playerId) ? nameOf.get(r.playerId) : undefined;
    if (!name) continue;
    out.push({ name, months: Number(r.months), people: Number(r.people), rank: giverRank(Number(r.months)).rank });
    if (out.length >= limit) break;
  }
  return out;
}

/** Months a PERSON gave others in one calendar year (their yearly recap), across their logins. */
export async function giftedMonthsInYear(playerId: number, year: string): Promise<number> {
  const [r] = await db
    .select({ months: sql<number>`coalesce(sum(${supporterSubscriptions.giftMonths}), 0)::int` })
    .from(supporterSubscriptions)
    .innerJoin(users, eq(users.id, supporterSubscriptions.giftedByUserId))
    .where(
      and(
        eq(users.playerId, playerId),
        ne(supporterSubscriptions.status, 'refunded'),
        sql`substr(${supporterSubscriptions.startedAt}, 1, 4) = ${year}`,
      ),
    );
  return Number(r?.months ?? 0);
}
