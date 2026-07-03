import { NextResponse } from 'next/server';
import { verifyTileEditor } from '@/lib/auth';
import { BOSSES } from '@/lib/constants';

// In-memory cache — fetched once per server lifecycle (same pattern as items-search).
let cachedNames: string[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

// Source: the OSRS Wiki MediaWiki API, Category:Monsters. Page titles are the in-game
// monster names, and crucially each variant is its own page — "The Nightmare",
// "Phosani's Nightmare", combat-level variants, etc. — so an admin can add every variant
// they want to count. The Wiki requires a descriptive User-Agent or it rejects the request.
//
// NOTE: this only helps spelling. The kill tile matches the name the RuneLite plugin
// reports on death (the NpcComposition name), which is usually but not always identical to
// the Wiki title — so the picker field stays free-text-editable for manual overrides.
const API_URL = 'https://oldschool.runescape.wiki/api.php';
const USER_AGENT = 'osrs-bingo-anvil (admin npc-name picker)';

async function getNames(): Promise<string[]> {
  if (cachedNames && Date.now() - cacheTimestamp < CACHE_TTL) {
    return cachedNames;
  }

  const seen = new Set<string>();
  let cmcontinue: string | undefined;
  // Hard cap the pagination so a Wiki API change can never spin this forever.
  for (let page = 0; page < 40; page++) {
    const params = new URLSearchParams({
      action: 'query',
      list: 'categorymembers',
      cmtitle: 'Category:Monsters',
      cmlimit: '500',
      cmtype: 'page',
      format: 'json',
    });
    if (cmcontinue) params.set('cmcontinue', cmcontinue);

    const res = await fetch(`${API_URL}?${params.toString()}`, {
      headers: { 'User-Agent': USER_AGENT },
    });
    if (!res.ok) throw new Error(`Failed to fetch OSRS monster list: HTTP ${res.status}`);

    const data = (await res.json()) as {
      query?: { categorymembers?: { title: string }[] };
      continue?: { cmcontinue?: string };
    };

    for (const m of data.query?.categorymembers ?? []) {
      if (typeof m.title === 'string' && m.title.trim()) seen.add(m.title.trim());
    }

    cmcontinue = data.continue?.cmcontinue;
    if (!cmcontinue) break;
  }

  cachedNames = Array.from(seen).sort((a, b) => a.localeCompare(b));
  cacheTimestamp = Date.now();
  return cachedNames;
}

export async function GET(request: Request) {
  // Tile-authoring support endpoint — editors configure kill tiles too, not just admins.
  const editor = await verifyTileEditor();
  if (!editor) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q')?.toLowerCase().trim();

  if (!query || query.length < 2) {
    return NextResponse.json([]);
  }

  try {
    const names = await getNames();

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
