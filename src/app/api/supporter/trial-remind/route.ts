import { NextResponse } from 'next/server';

import { verifyUser } from '@/lib/auth';
import { requestSupporterTrialReminder } from '@/lib/supporterPlanNotes';

/**
 * POST /api/supporter/trial-remind — "Remind me when the trial ends" on the caller's own Supporter
 * trial from Anvil. Only records the wish (lib/trialReminders sends the notice on the end date).
 */
export async function POST() {
  const session = await verifyUser();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await requestSupporterTrialReminder(session.userId))) return NextResponse.json({ error: 'There is no running trial to remind you about.' }, { status: 409 });
  return NextResponse.json({ ok: true });
}
