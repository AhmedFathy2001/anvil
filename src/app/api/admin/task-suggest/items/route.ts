import { NextResponse } from 'next/server';
import { verifyTileEditorAnywhere } from '@/lib/auth';
import { clogPageItems, itemObtainInfo } from '@/lib/itemObtain';

// GET /api/admin/task-suggest/items?ids=26813,26901 → how players come by each item (a monster drops
// it, or it lands in the inventory), its likeliest monster sources and its collection-log page — so
// the tile creator can pre-pick "how do players get them?". ?page=<clog page> → that page's items.
export async function GET(request: Request) {
  const editor = await verifyTileEditorAnywhere();
  if (!editor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const page = params.get('page');
  if (page) return NextResponse.json({ items: clogPageItems(page.slice(0, 80)) });
  const ids = (params.get('ids') ?? '')
    .split(',')
    .map((s) => parseInt(s, 10))
    .filter((n) => Number.isInteger(n) && n > 0)
    .slice(0, 100);
  return NextResponse.json({ items: ids.map(itemObtainInfo) });
}
