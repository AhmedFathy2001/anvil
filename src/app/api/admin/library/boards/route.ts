import { NextResponse } from 'next/server';
import { requireClan } from '@/lib/clanContext';
import { verifyUser } from '@/lib/auth';
import { atLeast } from '@/lib/clanRoles';
import { eventForRequest } from '@/lib/eventScope';
import { listBoards, publishFromEvent } from '@/lib/libraryBoards';

export const dynamic = 'force-dynamic';

// The board library: Anvil's boards and every published community board, plus this clan's own
// (hidden ones included, so it can republish). Read by anyone who can make events.

export async function GET() {
  const session = await verifyUser();
  if (!session || session.role === 'member') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const clan = await requireClan();
  const [published, mine] = await Promise.all([listBoards(), listBoards({ includeHidden: true, clanId: clan.id })]);
  const seen = new Set(published.map((b) => b.id));
  return NextResponse.json({ boards: [...published, ...mine.filter((b) => !seen.has(b.id))], clanId: clan.id });
}

// POST { eventId, title, description?, audience?, tags?, suggestedDays?, teamsMin?, teamsMax? } — share
// an event's board with every clan. Admins only: it publishes under the clan's name.
export async function POST(request: Request) {
  const session = await verifyUser();
  if (!session || !atLeast(session.role, 'admin')) return NextResponse.json({ error: 'Admins only.' }, { status: 401 });
  const clan = await requireClan();
  const body = await request.json().catch(() => null);
  const eventId = Number(body?.eventId);
  if (!Number.isInteger(eventId) || !(await eventForRequest(request, eventId))) {
    return NextResponse.json({ error: 'Event not found.' }, { status: 404 });
  }
  try {
    const board = await publishFromEvent(clan.id, session.userId, eventId, body ?? {});
    return NextResponse.json({ ok: true, board });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
