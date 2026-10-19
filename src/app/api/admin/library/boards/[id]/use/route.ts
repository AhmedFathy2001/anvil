import { NextResponse } from 'next/server';
import { requireClan } from '@/lib/clanContext';
import { verifyUser } from '@/lib/auth';
import { recordBoardUse } from '@/lib/libraryBoards';

// POST { eventId } — the create form made an event from this board: remember the link and count the
// use. Bookkeeping only; the event is scoped to this clan inside recordBoardUse.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifyUser();
  if (!session || session.role === 'member') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const clan = await requireClan();
  const body = await request.json().catch(() => null);
  const eventId = Number(body?.eventId);
  if (!Number.isInteger(eventId)) return NextResponse.json({ error: 'eventId required' }, { status: 400 });
  await recordBoardUse(Number((await params).id), eventId, clan.id);
  return NextResponse.json({ ok: true });
}
