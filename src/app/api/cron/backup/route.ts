import { NextResponse } from 'next/server';
import { backupDatabase } from '@/lib/backup';
import { timingSafeStrEqual } from '@/lib/auth';

// Daily off-box database backup. Cron hits this once a day, in a low-traffic hour, with CRON_SECRET.
// pg_dump takes a consistent snapshot of the database, gzips it, uploads it to the private backup
// bucket, then prunes old copies. A no-op (200) when S3_BACKUP_BUCKET isn't configured — so the job
// is safe to schedule everywhere and only does work where it's wired up.
//
// Once a day total, not once per clan: one database holds every clan now, so a per-clan schedule
// would just dump the same bytes N times.

export const maxDuration = 300; // pg_dump + gzip + upload of a full DB; generous headroom

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
  // A failed backup is an operational problem, not a client error — surface it as 500 so the cron
  // wrapper exits non-zero and it lands in cron's own mail/journal rather than passing silently.
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
