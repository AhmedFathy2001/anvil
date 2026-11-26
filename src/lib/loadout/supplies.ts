// Supply kinds → the forms a player may hold, best first, and what food heals. PURE.
// Matched by name (any dose), so a bank's "Super restore(3)" fills a restore slot.

import type { OwnedSupply, SupplyKind } from './types';

export interface SupplyForm {
  /** Case-insensitive name pattern, dose excluded. */
  match: RegExp;
  /** The name shown when the player holds none. */
  name: string;
  /** Hitpoints healed by one slot (all its doses), for the kills-per-trip estimate. */
  heals?: number;
}

const f = (match: RegExp, name: string, heals?: number): SupplyForm => ({ match, name, ...(heals ? { heals } : {}) });

export const SUPPLY_FORMS: Record<SupplyKind, SupplyForm[]> = {
  food: [f(/^anglerfish$/i, 'Anglerfish', 22), f(/^manta ray$/i, 'Manta ray', 22), f(/^dark crab$/i, 'Dark crab', 22), f(/^sea turtle$/i, 'Sea turtle', 21), f(/^shark$/i, 'Shark', 20), f(/^monkfish$/i, 'Monkfish', 16), f(/^swordfish$/i, 'Swordfish', 14), f(/^lobster$/i, 'Lobster', 12)],
  karambwan: [f(/^cooked karambwan$/i, 'Cooked karambwan', 18)],
  brew: [f(/^saradomin brew/i, 'Saradomin brew(4)', 64)],
  restore: [f(/^super restore/i, 'Super restore(4)'), f(/^sanfew serum/i, 'Sanfew serum(4)'), f(/^prayer potion/i, 'Prayer potion(4)')],
  prayer: [f(/^prayer potion/i, 'Prayer potion(4)'), f(/^super restore/i, 'Super restore(4)')],
  'antifire-super': [f(/^extended super antifire/i, 'Extended super antifire(4)'), f(/^super antifire/i, 'Super antifire potion(4)')],
  antifire: [f(/^extended super antifire/i, 'Extended super antifire(4)'), f(/^super antifire/i, 'Super antifire potion(4)'), f(/^extended antifire/i, 'Extended antifire(4)'), f(/^antifire potion/i, 'Antifire potion(4)')],
  antivenom: [f(/^extended anti-venom\+/i, 'Extended anti-venom+(4)'), f(/^anti-venom\+/i, 'Anti-venom+(4)'), f(/^anti-venom/i, 'Anti-venom(4)')],
  antipoison: [f(/^antidote\+\+/i, 'Antidote++(4)'), f(/^anti-venom/i, 'Anti-venom(4)'), f(/^superantipoison/i, 'Superantipoison(4)')],
  ranging: [f(/^divine ranging potion/i, 'Divine ranging potion(4)'), f(/^divine bastion potion/i, 'Divine bastion potion(4)'), f(/^bastion potion/i, 'Bastion potion(4)'), f(/^ranging potion/i, 'Ranging potion(4)')],
  'magic-boost': [f(/^saturated heart$/i, 'Saturated heart'), f(/^imbued heart$/i, 'Imbued heart'), f(/^divine magic potion/i, 'Divine magic potion(4)'), f(/^forgotten brew/i, 'Forgotten brew(4)'), f(/^magic potion/i, 'Magic potion(4)')],
  combat: [f(/^divine super combat/i, 'Divine super combat potion(4)'), f(/^super combat/i, 'Super combat potion(4)')],
  'teleport-zulrah': [f(/^zul-andra teleport$/i, 'Zul-andra teleport')],
  'raid-supplies': [],
};

export const SUPPLY_LABEL: Record<SupplyKind, string> = {
  food: 'food',
  karambwan: 'karambwans',
  brew: 'brews',
  restore: 'restores',
  prayer: 'prayer potions',
  'antifire-super': 'super antifire',
  antifire: 'antifire',
  antivenom: 'anti-venom',
  antipoison: 'antipoison',
  ranging: 'ranging boost',
  'magic-boost': 'magic boost',
  combat: 'combat boost',
  'teleport-zulrah': 'teleport back',
  'raid-supplies': 'room for raid supplies',
};

const plain = (n: string) => n.replace(/\s*\(\d\)\s*$/, '').trim();

/**
 * Up to `count` slots of a kind from what the player holds, best form first; `null` supplies =
 * not known, so the best form is assumed. Each pick is one inventory slot.
 */
export function pickSupplies(kind: SupplyKind, count: number, held: OwnedSupply[] | null, used: Map<number, number>): { id: number | null; name: string; heals: number }[] {
  const forms = SUPPLY_FORMS[kind];
  if (!forms.length || count <= 0) return [];
  if (!held) return Array.from({ length: count }, () => ({ id: null, name: forms[0].name, heals: forms[0].heals ?? 0 }));
  const out: { id: number | null; name: string; heals: number }[] = [];
  for (const form of forms) {
    // Highest dose first within a form.
    const mine = held.filter((s) => form.match.test(plain(s.name))).sort((a, b) => b.name.localeCompare(a.name));
    for (const s of mine) {
      while (out.length < count && (used.get(s.id) ?? 0) < s.q) {
        used.set(s.id, (used.get(s.id) ?? 0) + 1);
        out.push({ id: s.id, name: s.name, heals: form.heals ?? 0 });
      }
    }
    if (out.length >= count) break;
  }
  return out;
}
