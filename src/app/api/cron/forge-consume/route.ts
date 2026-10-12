import { NextResponse } from 'next/server';

import { timingSafeStrEqual } from '@/lib/auth';
import { declaredSweepOwner } from '@/lib/sweepOwner';
import { runStatsSweep } from '@/lib/statsSweep';

// The hiscores sweep with Anvil.Forge fetching (STATS_SWEEP_OWNER=forge). Every 5 min from the box
// cron: apply what Forge fetched since the last run, queue what is still due (lib/forgeFetchQueue).
// No hiscores traffic leaves this app, so running it more often than /api/cron/stats costs only
// database work — and keeps the gap between Forge's read and its effect short.

export const maxDuration = 300;

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: Request) {
  if (process.env.NODE_ENV === 'production' && !CRON_SECRET) {
    return NextResponse.json({ error: 'Server misconfigured: CRON_SECRET is required in production' }, { status: 500 });
  }
  const authHeader = request.headers.get('authorization');
  const hasValidSecret = !!CRON_SECRET && timingSafeStrEqual(authHeader ?? '', `Bearer ${CRON_SECRET}`);
  const devBypass = !CRON_SECRET && request.headers.get('x-vercel-cron') === '1';
  if (!hasValidSecret && !devBypass) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (declaredSweepOwner() !== 'forge') {
    return NextResponse.json({ success: true, skipped: 'site-owns', timestamp: new Date().toISOString() });
  }

  const { skipped, durationMs, results, forge } = await runStatsSweep('forge');
  return NextResponse.json({ success: true, timestamp: new Date().toISOString(), skipped, durationMs, forge, results });
}
