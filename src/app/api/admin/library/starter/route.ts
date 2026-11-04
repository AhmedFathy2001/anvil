import { NextResponse } from 'next/server';
import { verifyUser } from '@/lib/auth';
import { atLeast } from '@/lib/clanRoles';
import { listBoards } from '@/lib/libraryBoards';
import { listAnvilTasks } from '@/lib/libraryTasks';
import { SEED_TASKS } from '@/lib/tileLibrary';
import { pickStarterBoard, spreadStarterRows, starterCount } from '@/lib/starterTiles';

export const dynamic = 'force-dynamic';

// GET ?format=bingo|tilerace&size=N — ready-made tiles for the quick event screen. Read by the same
// people who can create events (admins), like the board library itself. Platform-wide content only
// (Anvil boards and Anvil tasks), so nothing here is clan-scoped.
export async function GET(request: Request) {
  const session = await verifyUser();
  if (!session || !atLeast(session.role, 'admin')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const url = new URL(request.url);
  const format = url.searchParams.get('format') === 'tilerace' ? 'tilerace' : 'bingo';
  const size = Number(url.searchParams.get('size'));
  if (!Number.isInteger(size) || size < 2 || size > 10) return NextResponse.json({ error: 'Bad size' }, { status: 400 });

  const board = pickStarterBoard(await listBoards(), format, size);
  if (board) return NextResponse.json({ boardId: board.id, title: board.title, rows: board.tiles });

  // No curated board of this shape yet: spread Anvil's task library, or the shipped seed when the
  // library table is empty (a fresh self-host).
  const tasks = await listAnvilTasks();
  const pool = tasks.length > 0 ? tasks : SEED_TASKS;
  const rows = spreadStarterRows(pool, starterCount(format, size), { ordered: format === 'tilerace' });
  return NextResponse.json({ boardId: null, title: null, rows });
}
