import { NextResponse } from 'next/server';

import { verifyUser } from '@/lib/auth';
import { GuideInputError } from '@/lib/guides';
import { createProposal, listMine } from '@/lib/guideProposals';
import { rateLimitByKey } from '@/lib/rate-limit';

// Proposals belong to the PERSON, not a clan: anyone signed in, anywhere, may propose a guide to the
// Anvil library. Reviewing is /api/staff/guides/proposals.

export async function GET() {
  const user = await verifyUser();
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  return NextResponse.json({ proposals: await listMine(user.userId) });
}

export async function POST(request: Request) {
  const user = await verifyUser();
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  const rl = await rateLimitByKey('guide-proposal', String(user.userId), { limit: 10, windowMs: 3_600_000 });
  if (!rl.ok) return NextResponse.json({ error: 'Too many proposals this hour — try again later.' }, { status: 429 });
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  try {
    const p = await createProposal(user.userId, {
      ...body,
      targetGuideId: body.targetGuideId != null ? Number(body.targetGuideId) : null,
      note: typeof body.note === 'string' ? body.note : null,
    });
    return NextResponse.json({ proposal: p });
  } catch (err) {
    if (err instanceof GuideInputError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
