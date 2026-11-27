import { NextResponse } from 'next/server';

import { verifyUser } from '@/lib/auth';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';
import { startFromAnvil } from '@/lib/tripLoadoutStart';

/**
 * My setups: "Start from Anvil's loadout". Signed-in session; the character must be one of the
 * person's own (lib/tripLoadoutStart checks it, and reads the bank through the owner-only snapshot):
 *   POST {accountId, content, plan}   → {id, name} of the new setup
 * Rate limited: each run works the whole loadout out from the bank.
 */

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const session = await verifyUser();
  if (!session?.userId || session.playerId == null) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  const rl = await rateLimit(request, `profile-setups-start:${session.userId}`, { limit: 6, windowMs: 10 * 60_000 });
  if (!rl.ok) return NextResponse.json({ error: 'That’s a few already, give it a few minutes.' }, { status: 429, headers: rateLimitHeaders(rl) });
  const body = (await request.json().catch(() => null)) as { accountId?: unknown; content?: unknown; plan?: unknown } | null;
  const accountId = Number(body?.accountId);
  if (!body || !Number.isInteger(accountId) || accountId <= 0 || typeof body.content !== 'string') return NextResponse.json({ error: 'Pick a character, a boss and a plan.' }, { status: 400 });
  const out = await startFromAnvil({ userId: session.userId, playerId: session.playerId }, accountId, body.content.slice(0, 40), body.plan);
  if (!out.ok) return NextResponse.json({ error: out.error }, { status: 400 });
  return NextResponse.json({ id: out.id, name: out.name });
}
