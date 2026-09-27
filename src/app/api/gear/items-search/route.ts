import { NextResponse } from 'next/server';

import { getItemMapping } from '@/lib/osrsItems';

// Any item by name (or id) — food, potions, runes, teleports — for a gear block's inventory. The
// equipment dataset only knows what can be worn. Public: it's the game's item list and nothing else.
export async function GET(request: Request) {
  const q = (new URL(request.url).searchParams.get('q') ?? '').trim().toLowerCase();
  if (q.length < 2) return NextResponse.json({ items: [] });
  const all = await getItemMapping();
  const items = /^\d+$/.test(q)
    ? all.filter((i) => i.id === Number(q))
    : all
        .filter((i) => i.name.toLowerCase().includes(q))
        .sort((a, b) => Number(!a.name.toLowerCase().startsWith(q)) - Number(!b.name.toLowerCase().startsWith(q)) || a.name.length - b.name.length)
        .slice(0, 30);
  return NextResponse.json({ items: items.map((i) => ({ id: i.id, name: i.name })) }, { headers: { 'Cache-Control': 'public, max-age=3600' } });
}
