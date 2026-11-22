import { NextResponse } from 'next/server';

import npcDrops from '@/data/npcDrops.json';
import { verifyAdminOrModerator } from '@/lib/auth';
import { BOSSES } from '@/lib/constants';
import { fuzzySearch } from '@/lib/fuzzySearch';
import { itemObtainInfo } from '@/lib/itemObtain';
import { getMonsterNames } from '@/lib/npcNames';
import { getItemMapping, isDroppableItem, type MappingItem } from '@/lib/osrsItems';
import { expandShorthands } from '@/lib/taskMatch';
import { PET_BOSS_KEYS, PET_GROUPS } from '@/lib/petGroups';

// The item hunt form's one search box: items by name (each with the sources the drop dataset lists
// for it, so the organiser sees which boss or activity it comes from), bosses by name (each with its
// rarest drops, so a hunt can be picked by browsing a boss), and pets, by their own name or by the
// boss they come from ("graardor" finds Pet general graardor): a pet is just another row.
//
// The same datasets the tile editor's item and monster pickers read (api/admin/items-search,
// api/admin/npc-search); this adds the join between them.

type DropRow = { i: number; d: number };
const drops = npcDrops as unknown as Record<string, DropRow[]>;

/** "Vorkath#Post-quest" is Vorkath; the wiki's own variants fold into one source. */
const baseName = (key: string) => key.split('#')[0].trim();

function sourcesOf(id: number): string[] {
  const info = itemObtainInfo(id);
  const seen = new Map<string, string>();
  for (const s of info.sources) {
    const name = baseName(s);
    if (!seen.has(name.toLowerCase())) seen.set(name.toLowerCase(), name);
  }
  // A raid chest, a minigame reward: no monster table lists it, and the collection-log page it sits
  // on is the name the drop arrives under ("Tombs of Amascut").
  if (seen.size === 0 && info.clogPage && info.clogPage !== 'All Pets') seen.set(info.clogPage.toLowerCase(), info.clogPage);
  return [...seen.values()];
}

const ALL_PETS = PET_GROUPS.find((g) => g.key === 'all')?.items ?? [];
const bossLabel = new Map(BOSSES.map((b) => [b.key, b.label.toLowerCase()]));

/** Pets whose name, or whose boss's name, holds every word typed. The collection log's own list. */
function petsFor(query: string): { id: number; name: string }[] {
  const words = query.toLowerCase().replace(/\bpet\b/g, ' ').split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  return ALL_PETS.filter((p) => {
    const hay = [p.name.toLowerCase(), ...(PET_BOSS_KEYS[p.id] ?? []).map((k) => bossLabel.get(k) ?? '')].join(' ');
    return words.every((w) => hay.includes(w));
  }).slice(0, 6);
}

export async function GET(request: Request) {
  const user = await verifyAdminOrModerator();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const query = new URL(request.url).searchParams.get('q')?.toLowerCase().trim();
  if (!query || query.length < 2) return NextResponse.json({ items: [], bosses: [], pets: [] });

  try {
    const mapping = await getItemMapping();
    const byId = new Map(mapping.map((m) => [m.id, m]));
    const itemName = (item: MappingItem) => item.name;
    const items = fuzzySearch(mapping, query, itemName, {
      limit: 12,
      tieBreak: 'alpha',
      alternates: [expandShorthands(query)],
      filter: isDroppableItem,
    }).map((item) => ({ id: item.id, name: item.name, sources: sourcesOf(item.id) }));

    const names = await getMonsterNames();
    const alternates = [expandShorthands(query), ...BOSSES.filter((b) => b.aliases?.some((a) => a.includes(query))).map((b) => b.label)];
    const bosses = fuzzySearch(names, query, (n: string) => n, { limit: 4, tieBreak: 'alpha', alternates })
      .map((name) => {
        const rows = new Map<number, number>();
        for (const [key, list] of Object.entries(drops)) {
          if (baseName(key).toLowerCase() !== name.toLowerCase()) continue;
          for (const r of list) rows.set(r.i, Math.max(rows.get(r.i) ?? 0, r.d));
        }
        // The drops a clan would hunt, not the runes: what the collection log lists first (the
        // game's own idea of this boss's uniques), then the rest, rarest first.
        const logged = (id: number) => (itemObtainInfo(id).clogPage ? 1 : 0);
        const top = [...rows.entries()]
          .sort((a, b) => logged(b[0]) - logged(a[0]) || b[1] - a[1])
          .map(([id]) => byId.get(id))
          .filter((m): m is MappingItem => !!m)
          .slice(0, 12)
          .map((m) => ({ id: m.id, name: m.name }));
        return { name, items: top };
      })
      .filter((b) => b.items.length > 0);

    // A pet found as a pet is not listed again as an item.
    const pets = petsFor(query);
    const petIds = new Set(pets.map((p) => p.id));
    return NextResponse.json({ items: items.filter((i) => !petIds.has(i.id)), bosses, pets });
  } catch (err) {
    console.error('hunt-search failed:', err);
    return NextResponse.json({ error: 'Search is not available right now.' }, { status: 500 });
  }
}
