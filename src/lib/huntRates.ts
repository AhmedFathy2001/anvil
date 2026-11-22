// The drop rates behind an item hunt's Due (lib/itemHunt huntRowProgress): for each row, the kills
// one drop is expected to take at each boss its "Closest to it" stat counts.
//
// Only the wiki drop dataset the repo ships (src/data/npcDrops.json, `npm run data:drops`), read
// the way every other rate on the site is (lib/dropOdds expectedKillsForItem: 1 in N per roll, r
// rolls a kill). A boss that dataset has no table for (the raids, the Gauntlet, Wintertodt and the
// other activities) gives nothing, and a skill gives nothing: there is no XP-based pet rate in the
// repo to stand on, so a skilling pet's row shows its XP and adds nothing to Due. Never a guess.
//
// Server only: the dataset is far too big to ship to a page. No database, so the tests read it.

import npcDrops from '@/data/npcDrops.json'; // regenerate with `npm run data:drops`
import { BOSSES } from '@/lib/constants';
import { expectedKillsForItem } from '@/lib/dropOdds';
import { type HuntConfig, type HuntRates, huntRows, rowStatKeys } from '@/lib/itemHunt';

interface DropEntry {
  i: number; // item id
  d: number; // 1-in-d per roll
  r?: number; // rolls per kill
}

const drops = npcDrops as unknown as Record<string, DropEntry[]>;
const labelOf = new Map(BOSSES.map((b) => [b.key, b.label]));

/**
 * Kills per drop of `itemId` at one hiscores boss, or null. The boss's own table only, under its
 * label exactly: an anchored variant ("Yama#Contract") is a different fight with different odds.
 * An item listed twice on the one table is rated by its rarer line, as the collection log's rarity
 * does (lib/clogRarity).
 */
export function killsPerDrop(itemId: number, bossKey: string): number | null {
  const label = labelOf.get(bossKey);
  const table = label ? drops[label] : undefined;
  if (!table) return null;
  let best: DropEntry | null = null;
  for (const e of table) if (e.i === itemId && Number.isFinite(e.d) && e.d > 0 && (!best || e.d > best.d)) best = e;
  if (!best) return null;
  const kills = expectedKillsForItem({ denominator: best.d, rolls: best.r && best.r > 0 ? best.r : 1 });
  return Number.isFinite(kills) && kills > 0 ? kills : null;
}

/** Every row's rates, keyed as the rows store their stat ("boss:generalGraardor"). Rows without one are left out. */
export function huntRates(config: HuntConfig): HuntRates {
  const out: HuntRates = {};
  for (const row of huntRows(config)) {
    for (const key of rowStatKeys(row.stat)) {
      const [type, metric] = key.split(':');
      if (type !== 'boss') continue;
      const kills = killsPerDrop(row.id, metric);
      if (kills == null) continue;
      (out[row.id] ??= {})[key] = kills;
    }
  }
  return out;
}

/** For the form: each item's 1-in-N at each hiscores boss that drops it, by boss key. */
export function itemBossRates(itemId: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const b of BOSSES) {
    const kills = killsPerDrop(itemId, b.key);
    if (kills != null) out[b.key] = Math.round(kills);
  }
  return out;
}
