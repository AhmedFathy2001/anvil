import { NextResponse } from 'next/server';
import { verifyTileEditorAnywhere } from '@/lib/auth';
import { libraryEditorUser } from '@/lib/guideAccess';
import { BOSSES } from '@/lib/constants';
import { getMonsterNames } from '@/lib/npcNames';

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
    // like any other query — labels that aren't real monster pages simply match nothing.
    const queries = [
      query,
      ...BOSSES.filter((b) => b.aliases?.some((a) => a.includes(query))).map((b) =>
        b.label.toLowerCase(),
      ),
    ];

    // Prefix matches first (more relevant), then any substring match; cap at 30 so a broad
    // term like "nightmare" still surfaces every variant the admin might want to add.
    const matches = names.filter((name) => {
      const n = name.toLowerCase();
      return queries.some((q) => n.includes(q));
    });
    matches.sort((a, b) => {
      const ap = queries.some((q) => a.toLowerCase().startsWith(q)) ? 0 : 1;
      const bp = queries.some((q) => b.toLowerCase().startsWith(q)) ? 0 : 1;
      return ap !== bp ? ap - bp : a.localeCompare(b);
    });

    return NextResponse.json(matches.slice(0, 30).map((name) => ({ name })));
  } catch (err) {
    console.error('npc-search failed:', err);
    return NextResponse.json({ error: 'Failed to fetch monster list' }, { status: 502 });
  }
}
