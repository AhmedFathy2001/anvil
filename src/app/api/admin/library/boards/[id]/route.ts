import { NextResponse } from 'next/server';
import { requireClan } from '@/lib/clanContext';
import { verifyUser } from '@/lib/auth';
import { atLeast } from '@/lib/clanRoles';
import { deleteBoard, getBoard, setBoardStatus, updateBoardMeta } from '@/lib/libraryBoards';

// A clan's own community board: edit its details, unpublish/republish it, or delete it. Anvil boards
// and other clans' boards are not this route's to touch.
async function ownBoard(id: number) {
  const session = await verifyUser();
  if (!session || !atLeast(session.role, 'admin')) return { error: NextResponse.json({ error: 'Admins only.' }, { status: 401 }) };
  const clan = await requireClan();
  const board = await getBoard(id);
  if (!board || board.origin !== 'community' || board.clanId !== clan.id) {
    return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  }
  return { board };
}

// PATCH { title?, description?, audience?, tags?, suggestedDays?, teamsMin?, teamsMax?, status? }
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const got = await ownBoard(Number((await params).id));
  if ('error' in got) return got.error;
  const body = await request.json().catch(() => ({}));
  try {
    if (body?.status === 'published' || body?.status === 'hidden') await setBoardStatus(got.board.id, body.status);
    if (typeof body?.title === 'string') await updateBoardMeta(got.board.id, { ...got.board, ...body });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
  return NextResponse.json({ ok: true, board: await getBoard(got.board.id) });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const got = await ownBoard(Number((await params).id));
  if ('error' in got) return got.error;
  await deleteBoard(got.board.id);
  return NextResponse.json({ ok: true });
}
