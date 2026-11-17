import { NextResponse } from 'next/server';

import { verifyAdmin, verifyUser } from '@/lib/auth';
import { requireClanFromRequest } from '@/lib/clanContext';
import { requestPlanTrialReminder } from '@/lib/planTrials';

/**
 * POST /api/admin/plan-trial/remind — "Remind me when the trial ends" on the clan's or space's trial
 * from Anvil. Records the wish on the trial (owner_trials.remind_requested_at); the daily billing
 * cron then puts a notice in the clan's admins' Anvil inbox on the end date, and a Discord message
 * for those who said yes to them (lib/trialReminders). Changes nothing about the trial or any charge.
 */
export async function POST(request: Request) {
  const session = await verifyUser();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const clan = await requireClanFromRequest(request);
  if (!clan) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Only this clan’s admins can do that.' }, { status: 403 });
  if (!(await requestPlanTrialReminder(clan.id))) return NextResponse.json({ error: 'There is no running trial to remind you about.' }, { status: 409 });
  return NextResponse.json({ ok: true });
}
