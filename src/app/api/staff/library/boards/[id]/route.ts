import { NextResponse } from 'next/server';
import { requireLibraryEditorApi } from '@/lib/guideAccess';
import { deleteBoard, getBoard, setBoardStatus, updateBoardMeta } from '@/lib/libraryBoards';

// Staff on any board: edit an Anvil board's details, hide or show any board (a community board that
// shouldn't be there), or delete a community one.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireLibraryEditorApi();
  if ('response' in g) return g.response;
  const board = await getBoard(Number((await params).id));
  if (!board) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  try {
    if (body?.status === 'published' || body?.status === 'hidden') await setBoardStatus(board.id, body.status);
    if (typeof body?.title === 'string') await updateBoardMeta(board.id, { ...board, ...body });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
  return NextResponse.json({ ok: true, board: await getBoard(board.id) });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireLibraryEditorApi();
  if ('response' in g) return g.response;
  const board = await getBoard(Number((await params).id));
  if (!board) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (board.origin !== 'community') return NextResponse.json({ error: 'Hide an Anvil board instead.' }, { status: 400 });
  await deleteBoard(board.id);
  return NextResponse.json({ ok: true });
}
