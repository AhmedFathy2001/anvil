import { NextResponse } from 'next/server';
import { clogItemNames, clogPageItems, clogPageNames } from '@/lib/clogDataset';
import { canonicalClogPage } from '@/lib/clogTiles';

// The collection-log catalogue, read-only, for anyone filing a collection-log tile slot by hand
// (components/TileDetailModal): the page list, or one page's items. It is the wiki's public data
// (src/data/clog.json), so it needs no session — and it keeps the 146 KB file out of client bundles.
//   GET                → { pages: string[] }
//   GET ?page=<name>   → { page, items: [{ id, name }] }
//   GET ?ids=1,2,3     → { items: [{ id, name }] } — a tile's chosen items

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const raw = params.get('page');
  const cache = { 'Cache-Control': 'public, max-age=3600' };
  const ids = params.get('ids');
  if (ids != null) {
    const names = clogItemNames();
    const items = [...new Set(ids.split(',').map(Number))].slice(0, 600)
      .filter((id) => names.has(id))
      .map((id) => ({ id, name: names.get(id)! }));
    return NextResponse.json({ items }, { headers: cache });
  }
  if (raw == null) return NextResponse.json({ pages: clogPageNames() }, { headers: cache });
  const page = canonicalClogPage(raw);
  if (!page) return NextResponse.json({ error: 'Unknown collection log page' }, { status: 404 });
  return NextResponse.json({ page, items: clogPageItems(page).map((i) => ({ id: i.id, name: i.name })) }, { headers: cache });
}
