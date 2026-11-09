import { NextResponse } from 'next/server';
import { listClanFees } from '@/lib/adminFees';
import { requireClanFromRequest } from '@/lib/clanContext';
import { verifyAdminOrModerator } from '@/lib/auth';

// Cross-event fee queue. Visible to admins and treasurers (mods read-only). Filters:
//   ?status=pending|reported|collected|disputed|confirmed|open  (open = anything not confirmed)
//   ?eventId=<n>
export async function GET(request: Request) {
  const session = await verifyAdminOrModerator();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Being an admin of one clan confers nothing in another, and this is a ledger of who owes and
  // who collected — so it is scoped to the clan whose host asked, not to the asker's role.
  const clan = await requireClanFromRequest(request);
  if (!clan) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const eventIdParam = url.searchParams.get('eventId');

  return NextResponse.json(await listClanFees(clan.id, status, eventIdParam));
}
