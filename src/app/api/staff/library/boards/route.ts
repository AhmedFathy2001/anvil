import { NextResponse } from 'next/server';
import { requireLibraryEditorApi } from '@/lib/guideAccess';
import { createAnvilBoard, getBoard, listBoards } from '@/lib/libraryBoards';

export const dynamic = 'force-dynamic';

export async function GET() {
  const g = await requireLibraryEditorApi();
  if ('response' in g) return g.response;
  return NextResponse.json({ boards: await listBoards({ includeHidden: true }) });
}

// POST { fromBoardId } — make an Anvil board out of a community one (it stays the clan's too). The
// usual way a great community board becomes an Anvil one.
export async function POST(request: Request) {
  const g = await requireLibraryEditorApi();
  if ('response' in g) return g.response;
  const body = await request.json().catch(() => null);
  const src = Number.isInteger(body?.fromBoardId) ? await getBoard(body.fromBoardId) : null;
  if (!src) return NextResponse.json({ error: 'Board not found.' }, { status: 404 });
  const board = await createAnvilBoard(g.actor.user.userId, { ...src, title: src.title });
  return NextResponse.json({ ok: true, board });
}
