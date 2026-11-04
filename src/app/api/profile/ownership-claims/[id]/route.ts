import { NextResponse } from 'next/server';

import { verifyUser } from '@/lib/auth';
import { rateLimitByKey } from '@/lib/rate-limit';
import { respondToClaim, withdrawClaim } from '@/lib/ownershipClaims';

/**
 * /api/profile/ownership-claims/[id] — answering a "This is my account" claim (lib/ownershipClaims).
 *
 *   POST { action: 'approve' }  the owner: it moves to the claimant (after any live event ends).
 *   POST { action: 'decline' }  the owner: it stays (an objection, in an objection window).
 *   POST { action: 'withdraw' } the claimant: never mind.
 *
 * The session is the only authority: the owner must still own the character, the claimant must be
 * the person who asked. Anyone else gets a 404, so a claim id says nothing about who is behind it.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifyUser();
  if (!session?.userId || !session.playerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const claimId = Number((await params).id);
  if (!Number.isInteger(claimId) || claimId <= 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const rl = await rateLimitByKey('ownership-claim-answer', String(session.userId), { limit: 20, windowMs: 10 * 60_000 });
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests — try again in a few minutes.' }, { status: 429 });

  const body = await request.json().catch(() => ({}));
  const action = body?.action;
  const out =
    action === 'approve' || action === 'decline'
      ? await respondToClaim({ claimId, userId: session.userId, playerId: session.playerId, action })
      : action === 'withdraw'
        ? await withdrawClaim({ claimId, userId: session.userId })
        : null;
  if (!out) return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  if (!out.ok) return NextResponse.json({ error: out.error }, { status: out.status ?? 400 });
  return NextResponse.json({ ok: true, status: out.status });
}
