// The odds behind one item: its best source from the wiki drop tables (src/data/npcDrops.json), the
// kills that source's rate expects (lib/dropOdds), and the time at our wiki-built kill rate
// (lib/efficiency bossKillsPerHour). Pure data — safe for any route.

import npcDrops from '@/data/npcDrops.json';
import { BOSSES } from '@/lib/constants';
import { expectedKillsForItem, hoursFor, itemChance } from '@/lib/dropOdds';
import { bossKillsPerHour } from '@/lib/efficiency';

interface DropEntry {
  i: number;
  d: number;
  r?: number;
}

export interface ItemOdds {
  itemId: number;
  source: string;
  denominator: number;
  rolls: number;
  /** Expected kills to the first drop. */
  expectedKills: number;
  killsPerHour: number | null;
  /** Expected hours at that kill rate; null when the source has no rate. */
  hours: number | null;
}

let index: Map<number, { source: string; d: number; r: number }[]> | null = null;
const bossByLabel = new Map(BOSSES.map((b) => [b.label.toLowerCase(), b.key]));

function sources(itemId: number) {
  if (!index) {
    index = new Map();
    for (const [source, drops] of Object.entries(npcDrops as unknown as Record<string, DropEntry[]>)) {
      for (const e of drops) {
        if (!e || typeof e.i !== 'number' || !(e.d > 0)) continue;
        const list = index.get(e.i) ?? [];
        list.push({ source: source.split('#')[0], d: e.d, r: e.r && e.r > 0 ? e.r : 1 });
        index.set(e.i, list);
      }
    }
  }
  return index.get(itemId) ?? [];
}

/**
 * Best source for an item: the fewest expected hours where a kill rate is known, else the best
 * per-kill chance.
 */
export function itemOdds(itemId: number): ItemOdds | null {
  let best: ItemOdds | null = null;
  for (const s of sources(itemId)) {
    const kph = bossKillsPerHour(bossByLabel.get(s.source.toLowerCase()) ?? '');
    const expectedKills = expectedKillsForItem({ denominator: s.d, rolls: s.r });
    const odds: ItemOdds = { itemId, source: s.source, denominator: s.d, rolls: s.r, expectedKills, killsPerHour: kph, hours: hoursFor(expectedKills, kph) };
    if (!best) best = odds;
    else if (odds.hours != null && (best.hours == null || odds.hours < best.hours)) best = odds;
    else if (odds.hours == null && best.hours == null && itemChance({ denominator: s.d, rolls: s.r }) > itemChance({ denominator: best.denominator, rolls: best.rolls })) best = odds;
  }
  return best;
}
