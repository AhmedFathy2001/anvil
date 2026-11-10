import { NextResponse } from 'next/server';

import { verifyUser } from '@/lib/auth';
import { rateLimitByKey } from '@/lib/rate-limit';
import { createGiftIntent, giftCheckoutConfigured, giftOptionsFor, giftRecipient } from '@/lib/supporterGiftCheckout';
import { GIFT_LENGTHS } from '@/lib/supporterGiftPurchase';
import { SUPPORTER_TIERS, type SupporterTierId } from '@/lib/supporterTiers';

export const dynamic = 'force-dynamic';

/**
 * POST {rsn}: who a Supporter gift for this character would reach, and each option with why it can't
 * be bought for them (they already pay for that tier or higher). POST {rsn, go: true, tier, months}:
 * the Gumroad checkout for that option (a one-time purchase, lib/supporterGiftCheckout). Signed in.
 */
export async function POST(request: Request) {
  const session = await verifyUser();
  if (!session?.userId) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  if (!giftCheckoutConfigured()) return NextResponse.json({ error: 'Gifts aren’t on sale yet.' }, { status: 503 });
  // Looking names up is a little enumeration surface: keep it slow.
  const limit = await rateLimitByKey('supporter-gift', String(session.userId), { limit: 20, windowMs: 10 * 60_000 });
  if (!limit.ok) return NextResponse.json({ error: 'Too many tries. Wait a few minutes.' }, { status: 429 });
  const body = (await request.json().catch(() => null)) as { rsn?: unknown; go?: unknown; tier?: unknown; months?: unknown } | null;
  if (typeof body?.rsn !== 'string') return NextResponse.json({ error: 'Bad body' }, { status: 400 });
  const who = await giftRecipient(body.rsn, session.userId);
  if ('error' in who) return NextResponse.json({ error: who.error }, { status: 404 });
  if (body.go !== true) return NextResponse.json({ name: who.name, options: await giftOptionsFor(who) });
  const tier = typeof body.tier === 'string' && body.tier in SUPPORTER_TIERS ? (body.tier as SupporterTierId) : null;
  const months = GIFT_LENGTHS.find((m) => m === body.months) ?? null;
  if (!tier || !months) return NextResponse.json({ error: 'Pick a tier and a length.' }, { status: 400 });
  const out = await createGiftIntent(session.userId, who, tier, months);
  if (!out) return NextResponse.json({ error: 'Gifts aren’t on sale yet.' }, { status: 503 });
  if ('error' in out) return NextResponse.json({ error: out.error }, { status: 409 });
  return NextResponse.json({ name: who.name, url: out.url });
}
