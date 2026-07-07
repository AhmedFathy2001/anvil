import { NextResponse } from 'next/server';
import { getItemMapping } from '@/lib/osrsItems';

// Public item-ID → name lookup so member-facing boards can display what a drop/gain tile
// tracks (those tiles store only OSRS item IDs). Item names are public game data — no auth.
// GET /api/items/names?ids=13576,11832 → [{ id, name }]
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ids = (searchParams.get('ids') ?? '')
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isInteger(n) && n > 0)
    .slice(0, 100);

  if (ids.length === 0) return NextResponse.json([]);

  try {
    const items = await getItemMapping();
    const byId = new Map(items.map((i) => [i.id, i.name]));
    return NextResponse.json(ids.map((id) => ({ id, name: byId.get(id) ?? `Item #${id}` })));
  } catch (err) {
    console.error('items/names failed:', err);
    return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 });
  }
}
