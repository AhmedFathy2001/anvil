import { NextResponse } from 'next/server';

import { verifyUser } from '@/lib/auth';
import { getClientIp } from '@/lib/clientIp';
import { fileReport, NOT_FOUND_ERROR, reportRateCheck } from '@/lib/platformReports';

export const dynamic = 'force-dynamic';

/**
 * "Report" to Anvil staff (lib/platformReports): a creator page or panel, a clan, an event, a player
 * profile or a stream highlight.
 *
 *   { type, id, category, note? }
 *
 * Signed-in only; rate-limited per person and per network; one open report per person per thing. The
 * answer is the same "thanks" for a new report and a repeat, and never says anything about who else
 * reported it. Something missing and something the reporter may not see get the identical 404
 * (lib/platformReports NOT_FOUND_ERROR), so a report cannot probe for private clans, events or
 * profiles. Addressed by ids rather than the host, so it works the same from a clan's subdomain, its
 * /c/<slug> path, a custom domain or the apex.
 */
export async function POST(request: Request) {
  const session = await verifyUser();
  if (!session?.userId) return NextResponse.json({ error: 'Sign in to report this.' }, { status: 401 });

  const rate = await reportRateCheck(session.userId, getClientIp(request));
  if (!rate.ok) {
    return NextResponse.json(
      { error: 'Thanks — you have sent a few reports already. Try again in a few minutes.' },
      { status: 429, headers: { 'Retry-After': String(Math.max(1, Math.ceil((rate.reset - Date.now()) / 1000))) } },
    );
  }

  const body = (await request.json().catch(() => null)) as { type?: unknown; id?: unknown; category?: unknown; note?: unknown } | null;
  if (!body) return NextResponse.json({ error: 'Bad request' }, { status: 400 });

  const r = await fileReport({
    type: body.type,
    id: body.id,
    category: body.category,
    note: body.note,
    reporterUserId: session.userId,
    reporterPlayerId: session.playerId ?? null,
  });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.error === NOT_FOUND_ERROR ? 404 : 400 });
  return NextResponse.json({ ok: true });
}
