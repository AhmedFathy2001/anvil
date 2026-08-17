import { NextResponse } from 'next/server';
import { backupDatabase } from '@/lib/backup';
import { timingSafeStrEqual } from '@/lib/auth';

// Daily off-box database backup. The control-plane cron dispatcher hits this once a day per clan
// (staggered across a low-traffic hour) with the clan's derived CRON_SECRET. It VACUUMs a consistent
// dump of the database, gzips it, and uploads it to the private backup bucket, then prunes old
// copies. A no-op (200) when S3_BACKUP_BUCKET isn't configured or the DB is remote — so the job is
// safe to schedule everywhere and only does work where it's wired up.

export const maxDuration = 300; // VACUUM + gzip + upload of a full DB; generous headroom

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

  const result = await backupDatabase();
  // A failed backup is an operational problem, not a client error — surface it as 500 so the
  // dispatcher records the clan as not-ok and it's visible in the tick log.
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
