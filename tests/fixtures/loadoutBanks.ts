// Synthetic banks for the loadout engine's golden tests and demo (scripts/loadout-demo.ts): an
// endgame ("max") bank and a mid-game one, by item name from the bundled gear data. Each holds what
// the reference loadouts' jobs ask for at its tier (a pickaxe, a demonbane weapon, a stab weapon).

import { indexGear, type GearData, type GearIndex } from '../../src/lib/dps/summary.ts';
import type { OwnedSupply, PlayerInput } from '../../src/lib/loadout/types.ts';
import itemsJson from '../../src/data/gearItems.json' with { type: 'json' };
import monstersJson from '../../src/data/gearMonsters.json' with { type: 'json' };

export const idx: GearIndex = indexGear({ items: (itemsJson as unknown as GearData).items, monsters: (monstersJson as unknown as GearData).monsters });

export function idOf(name: string): number {
  const it = idx.items.find((i) => i.n === name) ?? idx.items.find((i) => i.n.toLowerCase() === name.toLowerCase());
  if (!it) throw new Error(`gear data has no ${name}`);
  return it.id;
}

/** Gauntlet-only copies: they would top every list if the engine ever let them in. */
export const RESTRICTED = ['Corrupted bow (perfected)', 'Corrupted staff (perfected)'];

export const MAX_BANK = [
  // weapons
  "Tumeken's shadow", 'Twisted bow', 'Dragon hunter crossbow', "Osmumten's fang", 'Scythe of vitur', 'Dragon hunter lance', 'Toxic blowpipe', 'Bow of faerdhinen',
  'Sanguinesti staff', 'Trident of the swamp', "Slayer's staff", 'Kodai wand', 'Abyssal tentacle',
  // the jobs' gates and stand-ins (pickaxe, demonbane, punish, stab)
  'Noxious halberd', 'Emberlight', 'Dragon pickaxe', 'Purging staff', 'Soulreaper axe',
  // specs
  'Zaryte crossbow', 'Elder maul', 'Dragon warhammer', 'Bandos godsword', 'Dragon claws', 'Lightbearer',
  // ammo
  'Dragon arrow', 'Ruby dragon bolts (e)', 'Diamond dragon bolts (e)', 'Dragon dart',
  // ranged
  'Masori mask (f)', 'Masori body (f)', 'Masori chaps (f)', 'Crystal helm', 'Crystal body', 'Crystal legs', 'Necklace of anguish', 'Zaryte vambraces', 'Pegasian boots', "Blessed dizana's quiver", 'Venator ring', 'Dragonfire ward', 'Twisted buckler',
  'Void ranger helm', 'Elite void top', 'Elite void robe', 'Void knight gloves',
  // magic
  'Ancestral hat', 'Ancestral robe top', 'Ancestral robe bottom', 'Occult necklace', 'Confliction gauntlets', 'Eternal boots', 'Imbued saradomin cape', 'Magus ring', "Elidinis' ward (f)", 'Tome of fire',
  // melee
  'Torva full helm', 'Torva platebody', 'Torva platelegs', 'Amulet of rancour', 'Ferocious gloves', 'Primordial boots', 'Infernal cape', 'Ultor ring', 'Avernic defender',
  "Inquisitor's great helm", "Inquisitor's hauberk", "Inquisitor's plateskirt", "Inquisitor's mace",
  // shared / utility
  'Salve amulet(ei)', 'Serpentine helm', 'Avernic treads (max)', 'Ring of suffering (i)', 'Amulet of fury',
  // forms of pieces already listed: never carried twice
  'Masori body', "Osmumten's fang (or)",
  ...RESTRICTED,
].map(idOf);

export const MID_BANK = [
  'Armadyl crossbow', 'Rune crossbow', 'Magic shortbow', 'Trident of the swamp', "Slayer's staff", 'Abyssal whip', 'Dragon defender', 'Toxic blowpipe', 'Dragon warhammer',
  'Zamorakian hasta', 'Arclight', 'Rune pickaxe',
  'Ruby bolts (e)', 'Diamond bolts (e)', 'Rune arrow', 'Amethyst arrow', 'Rune dart',
  "Karil's coif", "Black d'hide body", "Black d'hide chaps", 'Barrows gloves', 'Ranger boots', "Ava's accumulator", 'Archers ring (i)', 'Anti-dragon shield',
  "Ahrim's hood", "Ahrim's robetop", "Ahrim's robeskirt", 'Occult necklace', 'Mystic hat', 'Infinity boots', "Mage's book", 'Seers ring (i)',
  'Helm of neitiznot', 'Fighter torso', 'Rune platelegs', 'Amulet of torture', 'Dragon boots', 'Fire cape', 'Berserker ring (i)',
  'Salve amulet(ei)', 'Amulet of glory', 'Ring of recoil',
  ...RESTRICTED,
].map(idOf);

/** Consumables by game id (outside the gear data). */
export const SUPPLIES: OwnedSupply[] = [
  { id: 13441, name: 'Anglerfish', q: 200 },
  { id: 385, name: 'Shark', q: 500 },
  { id: 3144, name: 'Cooked karambwan', q: 200 },
  { id: 3024, name: 'Super restore(4)', q: 100 },
  { id: 6685, name: 'Saradomin brew(4)', q: 100 },
  { id: 23685, name: 'Divine super combat potion(4)', q: 40 },
  { id: 2434, name: 'Prayer potion(4)', q: 100 },
  { id: 23733, name: 'Divine ranging potion(4)', q: 40 },
  { id: 3040, name: 'Magic potion(4)', q: 40 },
  { id: 22209, name: 'Extended super antifire(4)', q: 40 },
  { id: 12913, name: 'Anti-venom+(4)', q: 40 },
  { id: 5952, name: 'Antidote++(4)', q: 40 },
  { id: 12938, name: 'Zul-andra teleport', q: 50 },
];

/** A mid player has no super antifire (just the plain one) and no karambwans. */
export const MID_SUPPLIES: OwnedSupply[] = [
  { id: 385, name: 'Shark', q: 300 },
  { id: 391, name: 'Manta ray', q: 3 },
  { id: 2434, name: 'Prayer potion(4)', q: 60 },
  { id: 2444, name: 'Ranging potion(4)', q: 20 },
  { id: 3040, name: 'Magic potion(4)', q: 20 },
  { id: 21978, name: 'Super antifire potion(4)', q: 10 },
  { id: 12905, name: 'Anti-venom(4)', q: 10 },
  { id: 12938, name: 'Zul-andra teleport', q: 10 },
];

const MAXED = { attack: 99, strength: 99, defence: 99, ranged: 99, magic: 99, prayer: 99, hitpoints: 99 };
const MID = { attack: 85, strength: 88, defence: 80, ranged: 90, magic: 85, prayer: 70, hitpoints: 90 };

export const maxPlayer = (over: Partial<PlayerInput> = {}): PlayerInput => ({ levels: MAXED, owned: MAX_BANK, supplies: SUPPLIES, ...over });
/** Mid: no Rigour or Augury unlocked. */
export const midPlayer = (over: Partial<PlayerInput> = {}): PlayerInput => ({ levels: MID, prayers: ['piety'], owned: MID_BANK, supplies: MID_SUPPLIES, ...over });
