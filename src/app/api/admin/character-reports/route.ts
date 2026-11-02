import { NextResponse } from 'next/server';

import { verifyAdminOrModerator } from '@/lib/auth';
import { isReportKind } from '@/lib/characterReports';
import { raiseCharacterReport } from '@/lib/characterReportActions';
import { atLeast } from '@/lib/clanRoles';
import { seatForRequest } from '@/lib/roster';
import { rateLimitByKey } from '@/lib/rate-limit';

/**
 * POST /api/admin/character-reports { seatId, kind, body }
 *
 * "Report to Anvil" — the one thing a clan can do about a CHARACTER (lib/characterReports). Clan
 * moderators and up, about a seat on THEIR roster: the seat is resolved against the requesting clan,
 * so an id from another clan's roster answers 404 rather than letting one clan file on another's
 * members.
 *
 * From the clan OWNER, the change asked for (wrong owner → taken off them, rename → renamed) is made
 * at once and the report waits on /staff as "applied" for staff to approve or revert
 * (lib/characterReportActions). The response says whether it was applied and, if not, why.
 */
export async function POST(request: Request) {
  const session = await verifyAdminOrModerator();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const limited = await rateLimitByKey('character-report', String(session.userId), { limit: 30, windowMs: 3600_000 });
  if (!limited.ok) return NextResponse.json({ error: 'Too many reports. Try again later.' }, { status: 429 });

  const body = await request.json().catch(() => null);
  const seatId = Number(body?.seatId);
  if (!Number.isInteger(seatId) || seatId <= 0) return NextResponse.json({ error: 'seatId is required' }, { status: 400 });
  const kind = isReportKind(body?.kind) ? body.kind : 'other';
  const text = typeof body?.body === 'string' ? body.body.trim() : '';
  if (!text) return NextResponse.json({ error: 'Say what is wrong, so Anvil can act on it.' }, { status: 400 });

  const seat = await seatForRequest(request, seatId);
  if (!seat) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const requestedRsn = kind === 'rename' && typeof body?.requestedRsn === 'string' ? body.requestedRsn.trim().slice(0, 12) || null : null;
  if (kind === 'rename' && !requestedRsn) {
    return NextResponse.json({ error: 'Say what the new name is.' }, { status: 400 });
  }
  const report = await raiseCharacterReport(
    {
      accountId: seat.accountId,
      clanId: seat.clanId,
      reportedByUserId: session.userId > 0 ? session.userId : null,
      kind,
      body: text,
      requestedRsn,
    },
    { apply: atLeast(session.role, 'owner') },
  );
  return NextResponse.json({ ok: true, reportId: report.id, created: report.created, applied: report.applied, why: report.why });
}
