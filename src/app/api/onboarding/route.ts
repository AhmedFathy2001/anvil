import { NextResponse } from 'next/server';

import { verifyUser } from '@/lib/auth';
import { completeOnboarding, onboardingState, setSkipped, type StepKey } from '@/lib/onboarding';

export const dynamic = 'force-dynamic';

const STEPS: StepKey[] = ['discord', 'clan', 'character', 'plugin'];

/**
 * The person's own first-run state.
 *
 * PLATFORM, not clan — /welcome runs on the apex, where a person has no clan, and the whole point of
 * the flow is that they might not have one anywhere yet. Nothing here reads a Host.
 *
 * GET is also the flow's beacon: the clan and character steps complete because of something that
 * happens elsewhere — an admin adds you, the plugin reports in — so the page polls this rather than
 * asking somebody to reload until it works.
 */
export async function GET() {
  const session = await verifyUser();
  if (!session?.userId) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  return NextResponse.json(await onboardingState(session.userId, session.playerId));
}

/** POST { action: 'skip' | 'unskip' | 'complete', step? } — always about the CALLER's own flow. */
export async function POST(request: Request) {
  const session = await verifyUser();
  if (!session?.userId) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Bad body' }, { status: 400 });
  }

  const action = String(body.action);

  if (action === 'complete') {
    await completeOnboarding(session.userId);
    return NextResponse.json(await onboardingState(session.userId, session.playerId));
  }

  if (action === 'skip' || action === 'unskip') {
    const step = String(body.step) as StepKey;
    if (!STEPS.includes(step)) {
      return NextResponse.json({ error: 'Unknown step' }, { status: 400 });
    }
    // 'discord' is done by definition — you are holding a session. Skipping it would write a state
    // that can never be read, since a done step is never reported as skipped.
    if (step === 'discord') {
      return NextResponse.json({ error: 'That one is already done.' }, { status: 400 });
    }
    await setSkipped(session.userId, step, action === 'skip');
    return NextResponse.json(await onboardingState(session.userId, session.playerId));
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
