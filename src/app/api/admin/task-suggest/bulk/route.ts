import { NextResponse } from 'next/server';
import { verifyTileEditorAnywhere } from '@/lib/auth';
import { requireClan } from '@/lib/clanContext';
import { suggestBulk } from '@/lib/taskSuggest';

// POST /api/admin/task-suggest/bulk { lines: string[] } → one verdict per pasted line (ready / pick
// one / screenshot) for "Quick add: paste your list". Nothing is written here; the review table adds
// the tiles through the board's import route.
const MAX_LINES = 200;

export async function POST(request: Request) {
  const editor = await verifyTileEditorAnywhere();
  if (!editor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const clan = await requireClan();
  const body = (await request.json().catch(() => null)) as { lines?: unknown } | null;
  const lines = Array.isArray(body?.lines)
    ? body.lines.filter((l): l is string => typeof l === 'string').map((l) => l.trim().slice(0, 160)).filter(Boolean)
    : [];
  if (lines.length === 0) return NextResponse.json([]);
  if (lines.length > MAX_LINES) {
    return NextResponse.json({ error: `Up to ${MAX_LINES} lines at a time.` }, { status: 400 });
  }
  return NextResponse.json(await suggestBulk(clan.id, lines));
}
