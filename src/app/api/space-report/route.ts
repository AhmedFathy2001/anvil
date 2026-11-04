import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { clans } from '@/db/schema';
import { verifyUser } from '@/lib/auth';
import { isCreatorSpace } from '@/lib/creatorSpaces';
import { rateLimit, rateLimitByKey, rateLimitHeaders } from '@/lib/rate-limit';
import { reportContent } from '@/lib/spacePage/store';

export const dynamic = 'force-dynamic';

/**
 * "Report" on a creator space's page (lib/spacePage): a panel, or the page as a whole. Signed-in
 * viewers only, rate-limited per person and per network, and it lands in the platform staff queue at
 * /staff/promotions. Addressed by the space's id rather than by host, so it works the same from a
 * space's subdomain, its /c/<slug> path or a custom domain.
 */
export async function POST(request: Request) {
  const session = await verifyUser();
  if (!session?.userId) return NextResponse.json({ error: 'Sign in to report this.' }, { status: 401 });

  const perUser = await rateLimitByKey('space-report', String(session.userId), { limit: 5, windowMs: 10 * 60_000 });
  const perIp = await rateLimit(request, 'space-report-ip', { limit: 20, windowMs: 10 * 60_000 });
  if (!perUser.ok || !perIp.ok) {
    return NextResponse.json({ error: 'Thanks — you have sent a few reports already. Try again in a few minutes.' }, { status: 429, headers: rateLimitHeaders(perUser.ok ? perIp : perUser) });
  }

  const body = (await request.json().catch(() => null)) as { clanId?: unknown; panelId?: unknown; reason?: unknown } | null;
  const clanId = Number(body?.clanId);
  const panelId = body?.panelId == null ? null : Number(body.panelId);
  if (!Number.isInteger(clanId) || (panelId != null && !Number.isInteger(panelId))) {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
  // clan-scope: global -- addressed by the reported space's own id; it must be a creator space.
  const clan = await db.query.clans.findFirst({ where: eq(clans.id, clanId), columns: { id: true, slug: true, kind: true } });
  if (!clan || !isCreatorSpace(clan)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const r = await reportContent({ id: clan.id, slug: clan.slug }, { panelId, reason: body?.reason, reporterUserId: session.userId });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
