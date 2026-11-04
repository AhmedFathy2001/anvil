import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { users } from '@/db/schema';
import { verifyUser } from '@/lib/auth';
import { isApexHost } from '@/lib/clanContext';
import { createCreatorSpace } from '@/lib/clanCreate';
import { notifyClanCreated } from '@/lib/opsEvents';
import { rateLimitByKey } from '@/lib/rate-limit';
import { track } from '@/lib/analytics';

/**
 * POST /api/creators — make a creator space (lib/creatorSpaces) for the signed-in person.
 *
 * On the apex only, signed in, one each — the same platform-act rules as /api/clans, with the
 * in-game name gone and the per-person cap at one. The page (app/host) sends them straight on to the
 * new space's event wizard.
 */
export async function POST(request: Request) {
  if (!isApexHost((await headers()).get('host'))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const session = await verifyUser();
  if (!session) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });

  const limited = await rateLimitByKey('creator-create', String(session.userId), { limit: 3, windowMs: 3600_000 });
  if (!limited.ok) {
    return NextResponse.json({ error: 'Too many attempts just now. Try again later.' }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Bad body' }, { status: 400 });

  const result = await createCreatorSpace({
    slug: String(body.slug ?? ''),
    name: String(body.name ?? ''),
    ownerUserId: session.userId,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  // Fire-and-forget, as for a clan: a Discord outage must not fail the creation it reports.
  const owner = await db.query.users.findFirst({ where: eq(users.id, session.userId) });
  notifyClanCreated({
    clanId: result.clanId,
    slug: result.slug,
    name: String(body.name ?? result.slug).trim() || result.slug,
    inGameName: null,
    creator: true,
    owner: {
      displayName: owner?.displayName ?? null,
      discordId: owner?.discordId ?? null,
      discordUsername: owner?.discordUsername ?? null,
      email: owner?.email ?? null,
    },
  });
  track('creator.created', { clanId: result.clanId, userId: session.userId });

  return NextResponse.json({ ok: true, slug: result.slug, next: `/c/${result.slug}/admin/events/first` });
}
