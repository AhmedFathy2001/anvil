import { NextResponse } from 'next/server';

import { itemOdds } from '@/lib/itemOdds';

// Drop odds for items, from the wiki's drop tables and our wiki-built kill rates. Public game data,
// no session needed. GET ?ids=1,2,3 → { items: ItemOdds[] } (items with no known source are left out).
export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get('ids') ?? '';
  const ids = [...new Set(raw.split(',').map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 100);
  const items = ids.map(itemOdds).filter(Boolean);
  return NextResponse.json({ items }, { headers: { 'Cache-Control': 'public, max-age=3600' } });
}
