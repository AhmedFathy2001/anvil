import { NextResponse } from 'next/server';
import { verifyTileEditorAnywhere } from '@/lib/auth';
import { getItemMapping } from '@/lib/osrsItems';

export async function GET(request: Request) {
  // Tile-authoring support endpoint — editors configure drop/collection tiles too, not just admins.
  const editor = await verifyTileEditorAnywhere();
  if (!editor) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q')?.toLowerCase().trim();

  if (!query || query.length < 2) {
    return NextResponse.json([]);
  }

  try {
    const items = await getItemMapping();

    // A purely numeric query is an item-ID lookup — lets admins add untradeables (pets) by id,
    // and resolves names for pre-existing tracked IDs the name-search can't find.
    if (/^\d+$/.test(query)) {
      const id = parseInt(query, 10);
      const exact = items.find((item) => item.id === id);
      return NextResponse.json(exact ? [exact] : []);
    }

    // Prefix matches first (more relevant), then any substring match; cap at 20.
    const matches = items.filter((item) => item.name.toLowerCase().includes(query));
    matches.sort((a, b) => {
      const ap = a.name.toLowerCase().startsWith(query) ? 0 : 1;
      const bp = b.name.toLowerCase().startsWith(query) ? 0 : 1;
      return ap !== bp ? ap - bp : a.name.localeCompare(b.name);
    });

    return NextResponse.json(matches.slice(0, 20).map((item) => ({ id: item.id, name: item.name })));
  } catch (err) {
    console.error('items-search failed:', err);
    return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 });
  }
}
