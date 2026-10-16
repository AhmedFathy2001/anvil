import { NextResponse } from 'next/server';
import { timingSafeStrEqual } from '@/lib/auth';
import { eventsDueForPurge, purgeEventMedia } from '@/lib/eventMediaRetention';
import { eventsNeedingNotice, sendPurgeNotice } from '@/lib/eventMediaNotice';
import { log } from '@/lib/logger';

// Daily: remind clans ahead of deletion (lib/eventMediaNotice), then delete the proof images of
// events past their date (lib/eventMediaRetention) — 90 days after the end, and never sooner than a
// week after the first reminder. `?dryRun=1` lists the reminders and deletions it WOULD make.

const CRON_SECRET = process.env.CRON_SECRET;

export const maxDuration = 300;

export async function GET(request: Request) {
  if (process.env.NODE_ENV === 'production' && !CRON_SECRET) {
    return NextResponse.json({ error: 'Server misconfigured: CRON_SECRET is required in production' }, { status: 500 });
  }
  const authHeader = request.headers.get('authorization');
  const hasValidSecret = !!CRON_SECRET && timingSafeStrEqual(authHeader ?? '', `Bearer ${CRON_SECRET}`);
  // Local dev only. In production a missing secret is a 500 above, never an open door.
  const devBypass = process.env.NODE_ENV !== 'production' && !CRON_SECRET && request.headers.get('x-vercel-cron') === '1';
  if (!hasValidSecret && !devBypass) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const dryRun = new URL(request.url).searchParams.get('dryRun') === '1';
  const now = new Date();
  const notices = [];
  for (const e of await eventsNeedingNotice(now)) {
    notices.push(await sendPurgeNotice(e, now, { dryRun }));
  }
  const due = await eventsDueForPurge(now);
  const results = [];
  for (const e of due) {
    const r = await purgeEventMedia(e.id, { dryRun });
    if (r) results.push({ ...r, purgeAt: e.purgeAt.toISOString() });
  }
  const files = results.reduce((t, r) => t + r.files, 0);
  log.info('media-retention.tick', { dryRun, notices: notices.length, events: results.length, files });
  return NextResponse.json({ success: true, dryRun, notices, events: results.length, files, results });
}
