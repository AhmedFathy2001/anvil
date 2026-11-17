import { NextResponse } from 'next/server';
import { verifyAdminOrModerator } from '@/lib/auth';
import { requireClanFromRequest } from '@/lib/clanContext';
import { rateLimitByKey, rateLimitHeaders } from '@/lib/rate-limit';
import { loadAuditEntries } from '@/lib/auditLoad';

// GET /api/admin/clan/audit?before=<entry id>
//
// The next older slice of THIS clan's activity log, for the audit page's "Load older". Same access as
// the page (admin or moderator) and the same trimmed rows (lib/auditLoad). Filter and search stay on the
// page, which applies them to everything loaded.
export async function GET(request: Request) {
  const session = await verifyAdminOrModerator();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const rl = await rateLimitByKey('clan-audit-read', String(session.userId), { limit: 60, windowMs: 60_000 });
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests — try again shortly.' }, { status: 429, headers: rateLimitHeaders(rl) });
  const clan = await requireClanFromRequest(request);
  const before = Number(new URL(request.url).searchParams.get('before'));
  if (!Number.isInteger(before) || before < 1) return NextResponse.json({ error: 'Bad cursor' }, { status: 400 });
  return NextResponse.json(await loadAuditEntries(clan.id, before));
}
