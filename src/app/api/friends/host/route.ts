import { NextResponse } from 'next/server';

import { verifyUser } from '@/lib/auth';
import { ensureFriendsHost } from '@/lib/friendEvents';
import { rateLimitByKey } from '@/lib/rate-limit';

/**
 * "New friends event": the person's hidden friends host (lib/friendEvents), made on first use, and
 * where its quick event screen is. Needs a Supporter tier in force to make one; a host that already
 * exists is returned whatever the tier (its events stay theirs after a lapse).
 */
export async function POST() {
  const session = await verifyUser();
  if (!session || session.userId <= 0) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });

  const limited = await rateLimitByKey('friends-host', String(session.userId), { limit: 20, windowMs: 3600_000 });
  if (!limited.ok) return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });

  const r = await ensureFriendsHost(session.userId);
  if (!r.ok) return NextResponse.json({ error: r.error, reason: r.reason }, { status: 403 });
  return NextResponse.json({ ok: true, slug: r.host.slug, next: `/c/${r.host.slug}/admin/events/first` });
}
