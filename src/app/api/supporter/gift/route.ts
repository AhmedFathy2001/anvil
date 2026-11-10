import { NextResponse } from 'next/server';

import { verifyUser } from '@/lib/auth';
import { rateLimitByKey } from '@/lib/rate-limit';
import { createGiftIntent, giftCheckoutConfigured, giftRecipient } from '@/lib/supporterGiftCheckout';

export const dynamic = 'force-dynamic';

/**
 * POST {rsn, go?}: who a Supporter gift for this character would reach. With `go: true`, also the
 * Gumroad checkout for it (a one-time purchase, lib/supporterGiftCheckout). Signed in only.
 */
export async function POST(request: Request) {
  const session = await verifyUser();
  if (!session?.userId) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  if (!giftCheckoutConfigured()) return NextResponse.json({ error: 'Gifts aren’t on sale yet.' }, { status: 503 });
  // Looking names up is a little enumeration surface: keep it slow.
  const limit = await rateLimitByKey('supporter-gift', String(session.userId), { limit: 20, windowMs: 10 * 60_000 });
  if (!limit.ok) return NextResponse.json({ error: 'Too many tries. Wait a few minutes.' }, { status: 429 });
  const body = (await request.json().catch(() => null)) as { rsn?: unknown; go?: unknown } | null;
  if (typeof body?.rsn !== 'string') return NextResponse.json({ error: 'Bad body' }, { status: 400 });
  const who = await giftRecipient(body.rsn, session.userId);
  if ('error' in who) return NextResponse.json({ error: who.error }, { status: 404 });
  if (body.go !== true) return NextResponse.json({ name: who.name });
  const url = await createGiftIntent(session.userId, who);
  if (!url) return NextResponse.json({ error: 'Gifts aren’t on sale yet.' }, { status: 503 });
  return NextResponse.json({ name: who.name, url });
}
