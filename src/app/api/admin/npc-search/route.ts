import { NextResponse } from 'next/server';
import { verifyTileEditorAnywhere } from '@/lib/auth';
import { libraryEditorUser } from '@/lib/guideAccess';
import { BOSSES } from '@/lib/constants';
import { getMonsterNames } from '@/lib/npcNames';
import { fuzzySearch } from '@/lib/fuzzySearch';
import { expandShorthands } from '@/lib/taskMatch';

export async function GET(request: Request) {
  // Tile-authoring support endpoint — editors configure kill tiles too, not just admins.
  // Anvil library editors author tasks on the apex, outside any clan (api/library/* re-exports this).
  const editor = (await verifyTileEditorAnywhere()) ?? (await libraryEditorUser());
  if (!editor) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q')?.toLowerCase().trim();

  if (!query || query.length < 2) {
    return NextResponse.json([]);
  }

  try {
    const names = await getMonsterNames();

    // Boss aliases so "colosseum" finds Sol Heredit and "inferno" finds TzKal-Zuk. An alias
    // hit resolves to the boss label, which is then matched against the wiki monster list
    // like any other reading of the query — labels that aren't real monster pages match nothing.
    const alternates = [
      expandShorthands(query),
      ...BOSSES.filter((b) => b.aliases?.some((a) => a.includes(query))).map((b) => b.label),
    ];

    // Exact, prefix, word-start, substring, then typo-tolerant ("zulra" → Zulrah); cap at 30 so a
    // broad term like "nightmare" still surfaces every variant the admin might want to add.
    const matches = fuzzySearch(names, query, monsterName, { limit: 30, tieBreak: 'alpha', alternates });

    return NextResponse.json(matches.map((name) => ({ name })));
  } catch (err) {
    console.error('npc-search failed:', err);
    return NextResponse.json({ error: 'Failed to fetch monster list' }, { status: 502 });
  }
}

const monsterName = (name: string) => name;
