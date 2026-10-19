import { NextResponse } from 'next/server';
import { requireClan } from '@/lib/clanContext';
import { verifyTileEditorAnywhere } from '@/lib/auth';
import { anvilCategories, importAnvilTasks, importedTaskIds, listAnvilTasks } from '@/lib/libraryTasks';

export const dynamic = 'force-dynamic';

// The Anvil task library, as a clan sees it: every live task, marked with whether this clan already
// has a copy. Read by tile authors; importing is the same authority that changes the clan's library.

export async function GET() {
  const editor = await verifyTileEditorAnywhere();
  if (!editor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const clan = await requireClan();
  const [tasks, have, categories] = await Promise.all([listAnvilTasks(), importedTaskIds(clan.id), anvilCategories()]);
  return NextResponse.json({
    tasks: tasks.map((t) => ({ ...t, imported: have.has(t.id) })),
    categories,
  });
}

// POST { ids?: number[] } — copy Anvil tasks into this clan's library (all not-yet-imported when omitted).
export async function POST(request: Request) {
  const editor = await verifyTileEditorAnywhere();
  if (!editor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!editor.canEditTiles || editor.editorScope !== 'all') {
    return NextResponse.json({ error: 'Only your clan’s tile authors can change the library.' }, { status: 403 });
  }
  const clan = await requireClan();
  const body = await request.json().catch(() => ({}));
  const ids = Array.isArray(body?.ids) ? body.ids.filter((n: unknown) => Number.isInteger(n)).slice(0, 1000) : undefined;
  const added = await importAnvilTasks(clan.id, ids, editor.userId);
  return NextResponse.json({ ok: true, added });
}
