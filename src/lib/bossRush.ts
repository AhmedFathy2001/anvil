// Boss Rush, the server half of picking its drops (rules in lib/bossRushRules, lib/itemHunt).
//
// Picking a boss fills the rush's drop list with that boss's collection-log page, less the page's
// minor slots (lib/clogMinor: the commons, cosmetics and kits). The log is the game's own list of
// what is worth having from a boss, so a raid's page is its uniques and a boss's is its uniques and
// pet. Each comes back with its 1-in-N there when the repo's drop data has one, to help the host
// set the points; nothing is scored from it.
//
// Server only: the datasets are too big to ship to a page.

import { BOSSES } from '@/lib/constants';
import { pageUniques } from '@/lib/clogMinor';
import { killsPerDrop } from '@/lib/huntRates';
import { clogPageItems } from '@/lib/itemObtain';
import { isPetId } from '@/lib/itemHunt';
import { bossClogPage } from '@/lib/moments';

export interface RushDrop {
  id: number;
  name: string;
  /** The log pages it is on among the picked bosses: where it counts from. */
  sources: string[];
  pet: boolean;
  /** Kills one is expected to take at the commonest picked boss that has a rate; null without one (a raid). */
  rate: number | null;
}

/**
 * A boss table's 1-in-N. Never a raid's: the repo's raid data is each unique's share of a purple,
 * not its chance per raid, and "1/30" beside a Twisted bow would mislead whoever sets the points.
 */
function rateAt(itemId: number, bossKey: string): number | null {
  const kills = killsPerDrop(itemId, bossKey);
  return kills != null ? Math.round(kills) : null;
}

/** The drops a rush over these bosses lists to start with, in log order, a pet last. */
export function rushDropList(bossKeys: string[]): { drops: RushDrop[]; noPage: string[] } {
  const byId = new Map<number, RushDrop>();
  const noPage: string[] = [];
  for (const key of bossKeys) {
    const page = bossClogPage(key);
    if (!page) {
      noPage.push(BOSSES.find((b) => b.key === key)?.label ?? key);
      continue;
    }
    for (const it of pageUniques(page, clogPageItems(page))) {
      const rate = rateAt(it.id, key);
      const had = byId.get(it.id);
      if (had) {
        if (!had.sources.includes(page)) had.sources.push(page);
        if (rate != null && (had.rate == null || rate < had.rate)) had.rate = rate;
        continue;
      }
      const pet = isPetId(it.id);
      byId.set(it.id, { id: it.id, name: it.name, sources: pet ? [] : [page], pet, rate });
    }
  }
  const drops = [...byId.values()];
  return { drops: [...drops.filter((d) => !d.pet), ...drops.filter((d) => d.pet)], noPage };
}
