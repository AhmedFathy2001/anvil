// Boss Rush, the server half of picking its drops (rules in lib/bossRushRules, lib/itemHunt).
//
// Picking a target fills the rush's drop list with its notable drops:
//   - a boss or raid mode: its collection-log page, less the page's minor slots (lib/clogMinor: the
//     commons, cosmetics and kits). The log is the game's own list of what is worth having, so a
//     raid's page is its uniques (every mode of a raid shares one page, Entry Mode included);
//   - any other monster (Tormented Demons, Demonic gorillas): from its wiki drop table (src/data/npcDrops),
//     the drops on a collection-log page, else those rarer than 1 in RARE_FROM, rarest first.
// Each comes back with its 1-in-N there when the repo's data has one, to help the host set the
// points; nothing is scored from it.
//
// Server only: the datasets are too big to ship to a page.

import npcDrops from '@/data/npcDrops.json';
import { raidOfTarget } from '@/lib/bossRushRules';
import { clogMinorIds, pageUniques } from '@/lib/clogMinor';
import { killsPerDrop } from '@/lib/huntRates';
import { clogPageItems, itemObtainInfo } from '@/lib/itemObtain';
import { isPetId } from '@/lib/itemHunt';
import { bossClogPage } from '@/lib/moments';
import { getItemMapping } from '@/lib/osrsItems';
import { bossKeyForName } from '@/lib/pluginStats';

export interface RushDrop {
  id: number;
  name: string;
  /** Where it counts from: the log page it is on, or the monster. */
  sources: string[];
  pet: boolean;
  /** Kills one is expected to take, when the data has a rate; null without one (a raid). */
  rate: number | null;
}

/** A monster's drops rarer than this are its notable ones. */
const RARE_FROM = 100;
const MAX_MONSTER_DROPS = 15;

type DropRow = { i: number; d: number; r?: number };
const DROPS = npcDrops as unknown as Record<string, DropRow[]>;

/** The raid each tag's log page is filed under. */
const RAID_PAGE_KEY: Record<string, string> = { cox: 'chambersOfXeric', tob: 'theatreOfBlood', toa: 'tombsOfAmascut', 'toa-entry': 'tombsOfAmascut', 'tob-entry': 'theatreOfBlood' };

/** "Vorkath#Post-quest" is Vorkath: the wiki's own variants fold into one table. */
function monsterTable(name: string): DropRow[] {
  const want = name.trim().toLowerCase();
  const rows = new Map<number, DropRow>();
  for (const [key, list] of Object.entries(DROPS)) {
    if (key.split('#')[0].trim().toLowerCase() !== want) continue;
    for (const r of list) if (!rows.has(r.i) || r.d > (rows.get(r.i)?.d ?? 0)) rows.set(r.i, r);
  }
  return [...rows.values()];
}

/** A minor slot on the page it is logged on (a common, a cosmetic): not a drop to list. */
function minorAnywhere(id: number): boolean {
  const page = itemObtainInfo(id).clogPage;
  return page != null && clogMinorIds(page).has(id);
}

/** One target's notable drops. */
async function dropsOf(target: string): Promise<RushDrop[]> {
  const raid = raidOfTarget(target);
  const key = bossKeyForName(target) ?? (raid ? RAID_PAGE_KEY[raid] : null);
  const page = key ? bossClogPage(key) : null;
  if (page) {
    return pageUniques(page, clogPageItems(page)).map((it) => {
      const pet = isPetId(it.id);
      const kills = key && !raid ? killsPerDrop(it.id, key) : null;
      return { id: it.id, name: it.name, sources: pet ? [] : [page], pet, rate: kills != null ? Math.round(kills) : null };
    });
  }
  // Its collection-log drops when it has any (a Tormented Demon's synapse and claws, a gorilla's
  // zenyte and ballista parts): the rarest rows of a table are otherwise its shared rare-drop and
  // seed rolls, which nobody means.
  const all = monsterTable(target);
  const logged = all.filter((r) => itemObtainInfo(r.i).clogPage != null && !minorAnywhere(r.i));
  const table = (logged.length ? logged : all.filter((r) => r.d >= RARE_FROM)).sort((a, b) => b.d - a.d).slice(0, MAX_MONSTER_DROPS);
  if (table.length === 0) return [];
  const names = new Map((await getItemMapping()).map((m) => [m.id, m.name]));
  return table.flatMap((r) => {
    const name = names.get(r.i);
    if (!name) return [];
    const pet = isPetId(r.i);
    return [{ id: r.i, name, sources: pet ? [] : [target], pet, rate: Math.round(r.d / (r.r && r.r > 0 ? r.r : 1)) }];
  });
}

/** The drops a rush over these targets lists to start with: each target's in its order, the pets last. */
export async function rushDropList(targets: string[]): Promise<{ drops: RushDrop[] }> {
  const byId = new Map<number, RushDrop>();
  for (const t of targets) {
    for (const d of await dropsOf(t)) {
      const had = byId.get(d.id);
      if (!had) byId.set(d.id, d);
      else {
        for (const s of d.sources) if (!had.sources.includes(s)) had.sources.push(s);
        if (d.rate != null && (had.rate == null || d.rate < had.rate)) had.rate = d.rate;
      }
    }
  }
  const drops = [...byId.values()];
  return { drops: [...drops.filter((d) => !d.pet), ...drops.filter((d) => d.pet)] };
}
