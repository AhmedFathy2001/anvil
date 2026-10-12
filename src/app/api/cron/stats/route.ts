import { NextResponse } from 'next/server';
import { timingSafeStrEqual } from '@/lib/auth';
import { declaredSweepOwner } from '@/lib/sweepOwner';
import { purgePendingForgeFetches } from '@/lib/forgeFetchQueue';
import { runStatsSweep } from '@/lib/statsSweep';
import { log } from '@/lib/logger';

// The hiscores sweep, fetching in-process. Runs every 15 min from the box cron. The sweep itself —
// who is due, what a read means for bingo tiles, weekly rows and history — is lib/statsSweep; with
// STATS_SWEEP_OWNER=forge this route stands down and /api/cron/forge-consume runs the same sweep
// with Anvil.Forge doing the fetching.

const CRON_SECRET = process.env.CRON_SECRET;

// maxDuration is a Vercel-only cap and a no-op on the self-hosted box, where the run is instead
// bounded by the sweep's own wall-clock budget (with the host cron's curl -m timeout as a backstop).
export const maxDuration = 300;

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

  if (declaredSweepOwner() === 'forge') {
    return NextResponse.json({
      success: true,
      skipped: 'declared-forge',
      detail: 'Forge fetches the hiscores; /api/cron/forge-consume runs the sweep.',
      timestamp: new Date().toISOString(),
    });
  }

  // A queue left over from a Forge period would have Forge fetching alongside this sweep.
  const purged = await purgePendingForgeFetches().catch(() => 0);
  if (purged > 0) log.warn('stats-cron.purged-forge-queue', { purged });

  const { skipped, durationMs, results } = await runStatsSweep('site');
  return NextResponse.json({ success: true, timestamp: new Date().toISOString(), skipped, durationMs, results });
}
