import { NextResponse } from 'next/server';

import { timingSafeStrEqual } from '@/lib/auth';
import { sweepLapsedBilling } from '@/lib/billingLapse';
import { log } from '@/lib/logger';

// One Gumroad call per overdue paying clan — a handful, nothing that needs the sweeps' budget.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * Daily: end the memberships Gumroad stopped running without telling us (lib/billingLapse). A
 * deployment with no GUMROAD_ACCESS_TOKEN checks nothing and 200s. Same Bearer-CRON_SECRET auth as
 * the other /api/cron jobs.
 */
export async function GET(request: Request) {
  if (process.env.NODE_ENV === 'production' && !CRON_SECRET) {
    log.error('billing-cron.misconfigured', { reason: 'CRON_SECRET env var is unset in production' });
    return NextResponse.json({ error: 'Server misconfigured: CRON_SECRET is required in production' }, { status: 500 });
  }
  const authHeader = request.headers.get('authorization');
  const hasValidSecret = !!CRON_SECRET && timingSafeStrEqual(authHeader ?? '', `Bearer ${CRON_SECRET}`);
  // Local dev only. In production a missing secret is a 500 above, never an open door.
  const devBypass = process.env.NODE_ENV !== 'production' && !CRON_SECRET && request.headers.get('x-vercel-cron') === '1';
  if (!hasValidSecret && !devBypass) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await sweepLapsedBilling();
  log.info('billing-cron.done', { ...result, ended: result.ended.length });
  // Gumroad unreachable for some rows 502s so the cron log carries it; tomorrow's run asks again.
  return NextResponse.json({ ok: result.errors === 0, ...result }, { status: result.errors > 0 ? 502 : 200 });
}
