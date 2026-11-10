import { NextResponse } from 'next/server';
import { verifyTileEditorAnywhere } from '@/lib/auth';
import { libraryEditorUser } from '@/lib/guideAccess';
import { getItemMapping, isDroppableItem, type MappingItem } from '@/lib/osrsItems';
import { fuzzySearch } from '@/lib/fuzzySearch';
import { expandShorthands } from '@/lib/taskMatch';

export async function GET(request: Request) {
  // Tile-authoring support endpoint — editors configure drop/collection tiles too, not just admins.
  // Anvil library editors author tasks on the apex, outside any clan (api/library/* re-exports this).
  const editor = (await verifyTileEditorAnywhere()) ?? (await libraryEditorUser());
  if (!editor) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q')?.toLowerCase().trim();
  // Drop tiles can only be about items something actually drops, so the picker asks for the
  // loot-only list; other callers (gain tiles, name lookups) want the full item catalogue.
  const dropsOnly = searchParams.get('dropsOnly') === '1';

  if (!query || query.length < 2) {
    return NextResponse.json([]);
  }

  try {
    const items = await getItemMapping();

    // A purely numeric query is an item-ID lookup — lets admins add untradeables (pets) by id,
    // and resolves names for pre-existing tracked IDs the name-search can't find. Never filtered:
    // typing an exact id is a deliberate act, and it's how a tile's existing items get their names
    // back — including ones the drop dataset doesn't know about.
    if (/^\d+$/.test(query)) {
      const id = parseInt(query, 10);
      const exact = items.find((item) => item.id === id);
      return NextResponse.json(exact ? [exact] : []);
    }

    // Exact, then prefix, then word-start, then substring, then typo-tolerant ("znyte" → Zenyte
    // shard); OSRS shorthand rides along as a second reading ("tbow" → Twisted bow). Cap at 20.
    const matches = fuzzySearch(items, query, itemName, {
      limit: 20,
      tieBreak: 'alpha',
      alternates: [expandShorthands(query)],
      filter: dropsOnly ? isDroppableItem : undefined,
    });

    return NextResponse.json(matches.map((item) => ({ id: item.id, name: item.name })));
  } catch (err) {
    console.error('items-search failed:', err);
    return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 });
  }
}

const itemName = (item: MappingItem) => item.name;
