import { NextResponse } from 'next/server';
import { requireClan } from '@/lib/clanContext';
import { verifyTileEditorAnywhere } from '@/lib/auth';
import { answerOffers, taskOffers } from '@/lib/libraryTasks';

export const dynamic = 'force-dynamic';

// Anvil updated a task this clan had changed: take Anvil's version (and follow again) or keep theirs.

export async function GET() {
  const editor = await verifyTileEditorAnywhere();
  if (!editor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const clan = await requireClan();
  return NextResponse.json({ offers: await taskOffers(clan.id) });
}

// POST { rowIds: number[], answer: 'take' | 'keep' }
export async function POST(request: Request) {
  const editor = await verifyTileEditorAnywhere();
  if (!editor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!editor.canEditTiles || editor.editorScope !== 'all') {
    return NextResponse.json({ error: 'Only your clan’s tile authors can change the library.' }, { status: 403 });
  }
  const clan = await requireClan();
  const body = await request.json().catch(() => ({}));
  const answer = body?.answer === 'take' ? 'take' : body?.answer === 'keep' ? 'keep' : null;
  const rowIds = Array.isArray(body?.rowIds) ? body.rowIds.filter((n: unknown) => Number.isInteger(n)) : [];
  if (!answer || rowIds.length === 0) return NextResponse.json({ error: 'Pick tasks and take or keep.' }, { status: 400 });
  return NextResponse.json({ ok: true, answered: await answerOffers(clan.id, rowIds, answer) });
}
