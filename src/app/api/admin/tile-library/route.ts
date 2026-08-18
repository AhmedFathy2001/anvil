import { NextResponse } from 'next/server';
import { requireClan } from '@/lib/clanContext';
import { verifyTileEditorAnywhere } from '@/lib/auth';
import {
  addTasksFromRows,
  deleteTasks,
  importSeedTasks,
  libraryCategories,
  libraryTierCounts,
  listLibrary,
  pendingSeedTasks,
  updateTask,
} from '@/lib/tileLibrary';

export const dynamic = 'force-dynamic';

// The clan's task catalogue. Tile editors (not just admins) can read and curate it — it's the same
// authority that authors tiles on a board, and a board generated from the catalogue is just tile
// authoring by another route.

/** GET — the whole catalogue plus what the generator needs to render its controls. */
export async function GET() {
  const clan = await requireClan();
  const editor = await verifyTileEditorAnywhere();
  if (!editor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [tasks, categories, tierCounts, pending] = await Promise.all([
    listLibrary(clan.id),
    libraryCategories(clan.id),
    libraryTierCounts(clan.id),
    pendingSeedTasks(clan.id),
  ]);
  return NextResponse.json({
    tasks,
    categories,
    tierCounts,
    // How many curated starter tasks this clan has never imported — drives the "N new starter
    // tasks available" nudge. The tasks themselves aren't sent; the import route re-derives them.
    pendingSeedCount: pending.length,
  });
}

/**
 * POST — three curation actions on one route, chosen by `action`:
 *   { action: 'seed' }                     copy the pending starter tasks in
 *   { action: 'add', tasks: [...] }        harvest tiles from a board (or hand-write one)
 *   { action: 'update', id, ...fields }    edit one task in place
 *   { action: 'delete', ids: [...] }       drop tasks the clan doesn't want
 */
export async function POST(request: Request) {
  const editor = await verifyTileEditorAnywhere();
  if (!editor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const clan = await requireClan();

  const body = await request.json().catch(() => ({}));
  const action = body?.action;

  if (action === 'seed') {
    const added = await importSeedTasks(clan.id, Array.isArray(body.keys) ? body.keys : undefined, editor.userId);
    return NextResponse.json({ ok: true, added });
  }

  if (action === 'add') {
    if (!Array.isArray(body.tasks) || body.tasks.length === 0) {
      return NextResponse.json({ error: 'No tasks to add' }, { status: 400 });
    }
    if (body.tasks.length > 500) {
      return NextResponse.json({ error: 'Too many tasks in one go (max 500)' }, { status: 400 });
    }
    const added = await addTasksFromRows(clan.id, body.tasks, {
      sourceEventId: typeof body.sourceEventId === 'number' ? body.sourceEventId : null,
      userId: editor.userId,
    });
    return NextResponse.json({ ok: true, added });
  }

  if (action === 'update') {
    if (!Number.isInteger(body.id)) return NextResponse.json({ error: 'id required' }, { status: 400 });
    await updateTask(body.id, {
      label: typeof body.label === 'string' ? body.label : undefined,
      description: body.description === undefined ? undefined : (body.description || null),
      points: typeof body.points === 'number' ? body.points : undefined,
      category: body.category === undefined ? undefined : (body.category || null),
      config: body.config && typeof body.config === 'object' ? body.config : undefined,
    });
    return NextResponse.json({ ok: true });
  }

  if (action === 'delete') {
    const ids = Array.isArray(body.ids) ? body.ids.filter((n: unknown) => Number.isInteger(n)) : [];
    if (ids.length === 0) return NextResponse.json({ error: 'No ids given' }, { status: 400 });
    await deleteTasks(ids);
    return NextResponse.json({ ok: true, deleted: ids.length });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
