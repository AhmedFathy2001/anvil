// The supplies the pre-trip calc packs (lib/tripCheck): per kind, the items that count, best first,
// each with the id shown when the player has none (a 4-dose potion, the food itself). PURE.
// A kind's items match any dose ("Sanfew serum(2)"); a trip's template (lib/tripContent `supplies`)
// says how many of each kind, and food takes what the switches leave.

import type { SupplyKind } from './tripContent';

export interface SupplyItem {
  /** Shown when the player owns none of the kind. */
  id: number;
  re: RegExp;
}

export const SUPPLY_ITEMS: Record<SupplyKind, SupplyItem[]> = {
  Restores: [
    { id: 10925, re: /^sanfew serum\(\d\)$/i },
    { id: 3024, re: /^super restore\(\d\)$/i },
    { id: 2434, re: /^prayer potion\(\d\)$/i },
  ],
  Brews: [{ id: 6685, re: /^saradomin brew\(\d\)$/i }],
  'Combat potions': [
    { id: 23685, re: /^divine super combat potion\(\d\)$/i },
    { id: 12695, re: /^super combat potion\(\d\)$/i },
  ],
  'Ranging potions': [
    { id: 23733, re: /^divine ranging potion\(\d\)$/i },
    { id: 2444, re: /^ranging potion\(\d\)$/i },
    { id: 22461, re: /^(divine )?bastion potion\(\d\)$/i },
  ],
  // A heart is used again and again: one is all that is packed.
  'Magic boost': [
    { id: 27641, re: /^saturated heart$/i },
    { id: 20724, re: /^imbued heart$/i },
    { id: 23745, re: /^divine magic potion\(\d\)$/i },
    { id: 3040, re: /^magic potion\(\d\)$/i },
  ],
  Antifires: [
    { id: 22209, re: /^extended super antifire\(\d\)$/i },
    { id: 21978, re: /^super antifire potion\(\d\)$/i },
    { id: 11951, re: /^extended antifire\(\d\)$/i },
  ],
  'Anti-venoms': [
    { id: 12913, re: /^anti-venom\+\(\d\)$/i },
    { id: 12905, re: /^anti-venom\(\d\)$/i },
    { id: 5952, re: /^antidote\+\+\(\d\)$/i },
  ],
  Food: [
    { id: 13441, re: /^anglerfish$/i },
    { id: 391, re: /^manta ray$/i },
    { id: 11936, re: /^dark crab$/i },
    { id: 385, re: /^shark$/i },
  ],
};

/** The default template: restores, the styles' potions, food for the rest. */
export const DEFAULT_SUPPLIES: { kind: SupplyKind; n: number | 'fill'; style?: 'melee' | 'ranged' | 'magic' }[] = [
  { kind: 'Combat potions', n: 1, style: 'melee' },
  { kind: 'Ranging potions', n: 1, style: 'ranged' },
  { kind: 'Magic boost', n: 1, style: 'magic' },
  { kind: 'Restores', n: 2 },
  { kind: 'Food', n: 'fill' },
];

/** The kind's best item the player owns (by the bank's names), else null. */
export function ownedSupply(kind: SupplyKind, owned: readonly { id: number; name: string }[]): { id: number; item: SupplyItem } | null {
  for (const item of SUPPLY_ITEMS[kind]) {
    // The highest dose first: "(4)" before "(3)".
    const hits = owned.filter((o) => item.re.test(o.name.trim())).sort((a, b) => b.name.localeCompare(a.name));
    if (hits.length) return { id: hits[0].id, item };
  }
  return null;
}
