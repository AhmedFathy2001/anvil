import { NextResponse } from 'next/server';
import { flushPendingNotifications } from '@/lib/notifications';
import { processEventLifecycleNotifications } from '@/lib/eventLifecycle';
import { timingSafeStrEqual } from '@/lib/auth';

// Per-minute backstop for the submission-notification debounce. Opportunistic flushes (run at the end
// of each submission request) cover active events; this catches buckets that went quiet after the last
// request — e.g. a team finishes a kill grind and stops submitting — so their merged post still fires.
// A completing submission flushes inline, so this is only ever posting non-completion progress.
//
// It also fires the scheduled event start/end Discord posts. Running here (every minute) keeps them
// timely; the hourly stats cron would otherwise be up to ~an hour late.

export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: Request) {
  if (process.env.NODE_ENV === 'production' && !CRON_SECRET) {
    return NextResponse.json(
      { error: 'Server misconfigured: CRON_SECRET is required in production' },
      { status: 500 },
    );
  }
  const authHeader = request.headers.get('authorization');
  const hasValidSecret = !!CRON_SECRET && timingSafeStrEqual(authHeader ?? '', `Bearer ${CRON_SECRET}`);
  const devBypass = !CRON_SECRET && request.headers.get('x-vercel-cron') === '1';
  if (!hasValidSecret && !devBypass) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Independent concerns — don't let a lifecycle-notification failure block the debounce flush.
  await processEventLifecycleNotifications().catch(() => {});
  const posted = await flushPendingNotifications();
  return NextResponse.json({ posted });
}
