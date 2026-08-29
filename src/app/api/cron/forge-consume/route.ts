import { NextResponse } from 'next/server';

import { consumeForgeEvents } from '@/lib/forgeConsume';
import { timingSafeStrEqual } from '@/lib/auth';
import { log } from '@/lib/logger';

// Drain the Forge outbox and score it. Runs on the control-plane cron dispatcher, same as the TS
// hiscores sweep — but where /api/cron/stats FETCHES and scores, this only scores, because Forge did
// the fetching. The two are mutually exclusive: with the Go sweep enabled the TS sweep is off, so this
// is the scoring half and nothing double-counts. See lib/forgeConsume for the at-least-once design.

export const maxDuration = 300;

const CRON_SECRET = process.env.CRON_SECRET;

// A drain caps how many outbox rows one tick claims — big enough to keep up with the sweep, bounded so
// a backlog spike can't run the request past its wall-clock budget. Overridable via ?limit= for a
// manual catch-up after a replay (resetting consumed_at over a range).
const DEFAULT_LIMIT = 1000;

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

  const url = new URL(request.url);
  const limitParam = Number(url.searchParams.get('limit'));
  const limit = Number.isInteger(limitParam) && limitParam > 0 ? Math.min(limitParam, 10000) : DEFAULT_LIMIT;

  const start = Date.now();
  const result = await consumeForgeEvents({ limit });
  const durationMs = Date.now() - start;
  log.info('forge-consume.tick', { ...result, durationMs });

  return NextResponse.json({ success: true, timestamp: new Date().toISOString(), durationMs, ...result });
}
