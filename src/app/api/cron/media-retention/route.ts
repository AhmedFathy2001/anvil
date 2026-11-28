import { NextResponse } from 'next/server';
import { timingSafeStrEqual } from '@/lib/auth';
import { eventsDueForPurge, purgeEventMedia } from '@/lib/eventMediaRetention';
import { eventsNeedingNotice, sendPurgeNotice } from '@/lib/eventMediaNotice';
import { huntsDueForPurge, huntsNeedingNotice, purgeHuntMedia, sendHuntPurgeNotice } from '@/lib/huntMediaRetention';
import { log } from '@/lib/logger';

// Daily: remind clans ahead of deletion (lib/eventMediaNotice), then delete the proof images of
// events (and item hunts' drop screenshots, lib/huntMediaRetention) past their date (lib/eventMediaRetention) — 90 days after the end, and never sooner than a
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
  // Item hunts and Boss Rushes: their drop screenshots, on the same rules (lib/huntMediaRetention).
  const huntNotices = [];
  for (const h of await huntsNeedingNotice(now)) huntNotices.push(await sendHuntPurgeNotice(h, now, { dryRun }));
  const hunts = [];
  for (const h of await huntsDueForPurge(now)) {
    const r = await purgeHuntMedia(h.id, { dryRun });
    if (r) hunts.push({ ...r, purgeAt: h.purgeAt.toISOString() });
  }
  const files = results.reduce((t, r) => t + r.files, 0) + hunts.reduce((t, r) => t + r.files, 0);
  log.info('media-retention.tick', { dryRun, notices: notices.length + huntNotices.length, events: results.length, hunts: hunts.length, files });
  return NextResponse.json({ success: true, dryRun, notices, huntNotices, events: results.length, hunts, files, results });
}
