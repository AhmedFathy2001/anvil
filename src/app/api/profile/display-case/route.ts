import { NextResponse } from 'next/server';

import { verifyUser } from '@/lib/auth';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';
import { supporterForUser } from '@/lib/supporter';
import { displayCaseSlots } from '@/lib/profileMediaRules';
import {
  displayCaseCandidates,
  parsePinInput,
  pinToDisplayCase,
  readDisplayCase,
  reorderDisplayCase,
  unpinFromDisplayCase,
} from '@/lib/displayCase';

export const dynamic = 'force-dynamic';

// Your display case (Anvil Supporter: 4 slots, Champion 8, Patron 12). Yours only: every call is
// about the signed-in login, and a pin (item, kill count or time) is accepted only from one of their own verified
// characters (lib/displayCase). Slots are the tier NOW; removing and reordering work at any tier.

async function session() {
  const s = await verifyUser();
  return s?.userId ? s : null;
}

/** Their pins (all of them, so a lapsed supporter can see what is kept) and what they could pin. */
export async function GET() {
  const s = await session();
  if (!s) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  const [supporter, pins, candidates] = await Promise.all([
    supporterForUser(s.userId),
    readDisplayCase(s.userId, s.playerId ?? null),
    displayCaseCandidates(s.playerId ?? null),
  ]);
  return NextResponse.json({ slots: displayCaseSlots(supporter?.tier.id), pins, candidates });
}

export async function POST(request: Request) {
  const s = await session();
  if (!s) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  const rl = await rateLimit(request, 'display-case', { limit: 60, windowMs: 60_000 });
  if (!rl.ok) return NextResponse.json({ error: 'Slow down a little.' }, { status: 429, headers: rateLimitHeaders(rl) });
  const input = parsePinInput(await request.json().catch(() => null));
  if (!input) return NextResponse.json({ error: 'Bad body' }, { status: 400 });
  const supporter = await supporterForUser(s.userId);
  const result = await pinToDisplayCase(s.userId, s.playerId ?? null, supporter?.tier.id, input);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ id: result.id });
}

/** New order: { ids: number[] }, left to right. */
export async function PUT(request: Request) {
  const s = await session();
  if (!s) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { ids?: unknown } | null;
  const ids = Array.isArray(body?.ids) ? body!.ids.filter((v): v is number => typeof v === 'number' && Number.isInteger(v) && v > 0) : null;
  if (!ids || ids.length > 50) return NextResponse.json({ error: 'ids must be a list of pin ids' }, { status: 400 });
  await reorderDisplayCase(s.userId, ids);
  return NextResponse.json({ success: true });
}

/** Take one out: ?id=<pin id>. */
export async function DELETE(request: Request) {
  const s = await session();
  if (!s) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'id required' }, { status: 400 });
  await unpinFromDisplayCase(s.userId, id);
  return NextResponse.json({ success: true });
}
