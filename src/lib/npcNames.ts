// The OSRS Wiki's monster list (Category:Monsters), cached in memory. Shared by the kill picker's
// search (api/admin/npc-search) and the tile creator's matcher, which turns "100 cows" into a
// plugin kill tile on Cow. No database.

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

export async function getMonsterNames(): Promise<string[]> {
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

