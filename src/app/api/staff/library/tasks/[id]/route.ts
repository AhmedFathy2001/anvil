import { NextResponse } from 'next/server';
import { requireLibraryEditorApi } from '@/lib/guideAccess';
import { getAnvilTask, saveAnvilTask, setAnvilTaskArchived } from '@/lib/libraryTasks';

// PATCH { label, description?, category?, points, config } — save (bumps the version and rewrites
// every clan copy that follows it); or { archived: boolean } on its own.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireLibraryEditorApi();
  if ('response' in g) return g.response;
  const id = Number((await params).id);
  if (!(await getAnvilTask(id))) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const body = await request.json().catch(() => null);
  if (typeof body?.archived === 'boolean' && body.label === undefined) {
    await setAnvilTaskArchived(id, body.archived, g.actor.user.userId);
    return NextResponse.json({ ok: true, task: await getAnvilTask(id) });
  }
  if (!body || typeof body.label !== 'string' || typeof body.points !== 'number' || typeof body.config !== 'object') {
    return NextResponse.json({ error: 'A task needs a name, points and how it tracks.' }, { status: 400 });
  }
  try {
    return NextResponse.json({ ok: true, task: await saveAnvilTask(id, body, g.actor.user.userId) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
