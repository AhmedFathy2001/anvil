import { NextResponse } from 'next/server';

import { verifyUser } from '@/lib/auth';
import { getClientIp } from '@/lib/clientIp';
import { fileReport, reportRateCheck } from '@/lib/platformReports';

export const dynamic = 'force-dynamic';

/**
 * The first report route (creator pages, 0211), kept for pages already open in a browser: a panel, or
 * the page as a whole. New pages post to /api/report, which covers every kind; both share one rate
 * budget and one queue (lib/platformReports).
 */
export async function POST(request: Request) {
  const session = await verifyUser();
  if (!session?.userId) return NextResponse.json({ error: 'Sign in to report this.' }, { status: 401 });

  const rate = await reportRateCheck(session.userId, getClientIp(request));
  if (!rate.ok) {
    return NextResponse.json({ error: 'Thanks — you have sent a few reports already. Try again in a few minutes.' }, { status: 429 });
  }

  const body = (await request.json().catch(() => null)) as { clanId?: unknown; panelId?: unknown; reason?: unknown; category?: unknown } | null;
  const clanId = Number(body?.clanId);
  const panelId = body?.panelId == null ? null : Number(body.panelId);
  if (!Number.isInteger(clanId) || (panelId != null && !Number.isInteger(panelId))) {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
  const r = await fileReport({
    type: panelId != null ? 'creator_panel' : 'space',
    id: panelId ?? clanId,
    category: body?.category ?? null,
    note: body?.reason,
    reporterUserId: session.userId,
    reporterPlayerId: session.playerId ?? null,
  });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
