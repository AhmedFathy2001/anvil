import { NextResponse } from 'next/server';
import { timingSafeStrEqual } from '@/lib/auth';
import { eventsDueForPurge, purgeEventMedia } from '@/lib/eventMediaRetention';
import { log } from '@/lib/logger';

// Daily: delete the proof images of events that ended more than 90 days ago (lib/eventMediaRetention).
// `?dryRun=1` lists what it WOULD delete — run that first on a fresh deployment, because the first
// real run clears every event that is already past the window.

const CRON_SECRET = process.env.CRON_SECRET;

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

  const dryRun = new URL(request.url).searchParams.get('dryRun') === '1';
  const due = await eventsDueForPurge(new Date());
  const results = [];
  for (const e of due) {
    const r = await purgeEventMedia(e.id, { dryRun });
    if (r) results.push({ ...r, purgeAt: e.purgeAt.toISOString() });
  }
  const files = results.reduce((t, r) => t + r.files, 0);
  log.info('media-retention.tick', { dryRun, events: results.length, files });
  return NextResponse.json({ success: true, dryRun, events: results.length, files, results });
}
