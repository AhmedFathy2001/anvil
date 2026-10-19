import { NextResponse } from 'next/server';
import { requireLibraryEditorApi } from '@/lib/guideAccess';
import { listAnvilTasks, saveAnvilTask } from '@/lib/libraryTasks';

export const dynamic = 'force-dynamic';

// Writing the Anvil task library: Anvil staff and library editors (lib/guideAccess.canEditLibrary).
// Same authority as the guide library — it's one library with two kinds of content.

export async function GET() {
  const g = await requireLibraryEditorApi();
  if ('response' in g) return g.response;
  return NextResponse.json({ tasks: await listAnvilTasks({ includeArchived: true }) });
}

// POST { label, description?, category?, points, config } — a new Anvil task.
export async function POST(request: Request) {
  const g = await requireLibraryEditorApi();
  if ('response' in g) return g.response;
  const body = await request.json().catch(() => null);
  if (!body || typeof body.label !== 'string' || typeof body.points !== 'number' || typeof body.config !== 'object') {
    return NextResponse.json({ error: 'A task needs a name, points and how it tracks.' }, { status: 400 });
  }
  try {
    return NextResponse.json({ ok: true, task: await saveAnvilTask(null, body, g.actor.user.userId) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
