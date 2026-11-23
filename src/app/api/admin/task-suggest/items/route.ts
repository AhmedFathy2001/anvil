import { NextResponse } from 'next/server';
import { verifyTileEditorAnywhere } from '@/lib/auth';
import { clogPageItems, itemObtainInfo } from '@/lib/itemObtain';
import { clogMinorIds } from '@/lib/clogMinor';

// GET /api/admin/task-suggest/items?ids=26813,26901 → how players come by each item (a monster drops
// it, or it lands in the inventory), its likeliest monster sources and its collection-log page — so
// the tile creator can pre-pick "how do players get them?". ?page=<clog page> → that page's items,
// each flagged `minor` when it is a page's minor slot.
export async function GET(request: Request) {
  const editor = await verifyTileEditorAnywhere();
  if (!editor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const page = params.get('page');
  if (page) {
    // `minor`: not what a bingo means by a unique (lib/clogMinor) — the creator adds these only on ask.
    const name = page.slice(0, 80);
    const minor = clogMinorIds(name);
    return NextResponse.json({ items: clogPageItems(name).map((i) => ({ ...i, minor: minor.has(i.id) })) });
  }
  const ids = (params.get('ids') ?? '')
    .split(',')
    .map((s) => parseInt(s, 10))
    .filter((n) => Number.isInteger(n) && n > 0)
    .slice(0, 100);
  return NextResponse.json({ items: ids.map(itemObtainInfo) });
}
