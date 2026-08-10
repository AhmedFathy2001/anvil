import { NextResponse } from 'next/server';
import { verifyTileEditorAnywhere } from '@/lib/auth';
import { drawTasks } from '@/lib/tileLibrary';

export const dynamic = 'force-dynamic';

// POST /api/admin/tile-library/draw — "8 easy, 10 medium, 5 hard" out of the catalogue.
//
// Server-side so the randomness and the tier mapping (which reads the clan's own tier_bands) can't
// drift from what the rest of the app believes. Returns the drawn tasks plus any tier that came up
// short, so the caller can say "only 3 hard tasks in the library" instead of quietly building a
// smaller board than asked for.
export async function POST(request: Request) {
  const editor = await verifyTileEditorAnywhere();
  if (!editor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const counts = body?.counts;
  if (!counts || typeof counts !== 'object') {
    return NextResponse.json({ error: 'counts is required' }, { status: 400 });
  }

  const total = Object.values(counts as Record<string, unknown>)
    .map((n) => (typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0))
    .reduce((a, b) => a + b, 0);
  if (total === 0) return NextResponse.json({ error: 'Ask for at least one task' }, { status: 400 });
  if (total > 1000) return NextResponse.json({ error: 'Boards are capped at 1000 tiles' }, { status: 400 });

  const result = await drawTasks({
    counts: counts as Record<string, number>,
    categories: Array.isArray(body.categories) ? body.categories : undefined,
    exclude: Array.isArray(body.exclude) ? body.exclude.filter((n: unknown) => Number.isInteger(n)) : undefined,
  });

  return NextResponse.json(result);
}
