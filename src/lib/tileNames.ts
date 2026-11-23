// Tile names that read like a person wrote them: "ToA unique", "3 different ToA uniques", "Tbow or
// Scythe", "GWD hilt", "5 new Barrows log slots" — never "Any of …" or "Any 4 of 25 items". Named by
// what the items share: one log page or boss, a family of bosses, a word, or, for two or three, the
// items themselves. Pure and data-free (callers pass where each item comes from), so the creator,
// the matcher and the clog dialog all name a tile the same way. Only NEW names come from here.

/** A log page as people say it: "Tombs of Amascut" → ToA, "Barrows Chests" → Barrows, "The Nightmare" → Nightmare. */
const PAGE_SHORT: Record<string, string> = {
  'Tombs of Amascut': 'ToA',
  'Chambers of Xeric': 'CoX',
  'Theatre of Blood': 'ToB',
  'Barrows Chests': 'Barrows',
  'Dagannoth Kings': 'DKs',
  'Fortis Colosseum': 'Colosseum',
  'Alchemical Hydra': 'Hydra',
};

export function shortPage(page: string): string {
  return PAGE_SHORT[page] ?? page.replace(/^The /, '');
}

/** Bosses a clan names as one group. */
const PAGE_FAMILIES: [string, string[]][] = [
  ['GWD', ['General Graardor', "Kree'arra", "K'ril Tsutsaroth", 'Commander Zilyana', 'Nex']],
  ['DT2', ['Duke Sucellus', 'The Leviathan', 'The Whisperer', 'Vardorvis']],
  ['Wildy boss', ['Callisto and Artio', "Vet'ion and Calvar'ion", 'Venenatis and Spindel', 'Chaos Elemental', 'Chaos Fanatic', 'Crazy Archaeologist', 'Scorpia']],
  ['Raid', ['Chambers of Xeric', 'Theatre of Blood', 'Tombs of Amascut']],
];

/** Item names as clans write them. */
const ITEM_SHORT: Record<string, string> = {
  'twisted bow': 'Tbow',
  'scythe of vitur': 'Scythe',
  "tumeken's shadow": 'Shadow',
  "osmumten's fang": 'Fang',
  'dragon warhammer': 'DWH',
  'zaryte crossbow': 'ZCB',
  'armadyl crossbow': 'ACB',
  'dragon hunter crossbow': 'DHCB',
  'dragon hunter lance': 'Lance',
  'bow of faerdhinen': 'Bowfa',
  'sanguinesti staff': 'Sang',
  'ghrazi rapier': 'Rapier',
  'kodai insignia': 'Kodai',
  'dexterous prayer scroll': 'Dex scroll',
  'arcane prayer scroll': 'Arcane scroll',
  'elder maul': 'Elder maul',
};

export function shortItem(name: string): string {
  const plain = name.replace(/\s*\((?:uncharged|charged|inactive|empty|full)\)$/i, '').trim();
  return ITEM_SHORT[plain.toLowerCase()] ?? plain;
}

const plural = (w: string) => (/s$/i.test(w) ? w : /y$/i.test(w) && !/[aeiou]y$/i.test(w) ? `${w.slice(0, -1)}ies` : `${w}s`);

/** "A or B", "A, B or C"; with 'and': "A, B & C". */
export function listNames(names: string[], joiner: 'or' | 'and' = 'or'): string {
  if (names.length <= 1) return names[0] ?? '';
  const last = joiner === 'or' ? ' or ' : ' & ';
  return `${names.slice(0, -1).join(', ')}${last}${names[names.length - 1]}`;
}

export interface NamedItem {
  id: number;
  name: string;
}

export interface PoolNameOpts {
  items: NamedItem[];
  /** 'any': one of them (or n, repeats count); 'each': every one of them. */
  need: 'any' | 'each';
  /** How many are needed (any mode). */
  amount?: number | null;
  /** Each item counts once. */
  distinct?: boolean;
  /** The log pages an item is on, when known. */
  pagesOf?: (id: number) => readonly string[] | undefined;
  /** Item ids that are pets (the log's All Pets page). */
  petIds?: ReadonlySet<number>;
}

/** The one page every item is on, if there is one (All Pets never counts as "where it's from"). */
function sharedPage(items: NamedItem[], pagesOf: PoolNameOpts['pagesOf']): string | null {
  if (!pagesOf) return null;
  let common: string[] | null = null;
  for (const it of items) {
    const pages = (pagesOf(it.id) ?? []).filter((p) => p !== 'All Pets');
    if (pages.length === 0) return null;
    common = common == null ? [...pages] : common.filter((p) => pages.includes(p));
    if (common.length === 0) return null;
  }
  return common?.[0] ?? null;
}

function sharedFamily(items: NamedItem[], pagesOf: PoolNameOpts['pagesOf']): string | null {
  if (!pagesOf) return null;
  for (const [label, pages] of PAGE_FAMILIES) {
    if (items.every((it) => (pagesOf(it.id) ?? []).some((p) => pages.includes(p)))) return label;
  }
  return null;
}

/** The last word every name ends with ("Bandos hilt", "Armadyl hilt" → "hilt"). */
function sharedLastWord(names: string[]): string | null {
  const last = names.map((n) => n.trim().split(/\s+/).pop()!.toLowerCase());
  return last.every((w) => w === last[0]) && names.every((n) => n.trim().includes(' ')) ? last[0] : null;
}

/** The noun for things from one page: pets, Barrows pieces, else uniques. */
function pageNoun(page: string, items: NamedItem[], petIds?: ReadonlySet<number>): string {
  if (petIds && items.every((i) => petIds.has(i.id))) return 'pet';
  if (page === 'Barrows Chests') return 'piece';
  return 'unique';
}

/**
 * A drop or gain tile's name from its items: "Zenyte shard", "Tbow or Scythe", "ToA unique",
 * "3 different ToA uniques", "Every Barrows piece", "GWD hilt", "Tbow, Scythe or 4 more".
 */
export function itemPoolTitle(o: PoolNameOpts): string {
  const n = Math.max(1, o.amount ?? 1);
  const names = o.items.map((i) => shortItem(i.name));
  if (names.length === 0) return 'Drop';
  if (names.length === 1) return n > 1 ? `${n} × ${names[0]}` : names[0];

  // Several items from the same owner ("Dharok's helm", "Dharok's greataxe") are that owner's set.
  const owner = /^(.+?['’]s)\s/.exec(o.items[0].name)?.[1];
  const oneOwner = owner && o.items.every((i) => i.name.startsWith(`${owner} `)) ? owner : null;

  // Two or three: their own names read best.
  if (names.length <= 3) {
    if (o.need === 'each') return oneOwner ? `${oneOwner} ${listNames(o.items.map((i) => i.name.slice(oneOwner.length + 1)), 'and')}` : listNames(names, 'and');
    if (n === 1) return listNames(names);
    return o.distinct ? `${n} different: ${listNames(names)}` : `${n} × ${listNames(names)}`;
  }

  const page = sharedPage(o.items, o.pagesOf);
  const family = page ? null : sharedFamily(o.items, o.pagesOf);
  const word = sharedLastWord(names);
  if (o.need === 'each') {
    if (oneOwner) return `${oneOwner} set`;
    if (page) return `Every ${shortPage(page)} ${pageNoun(page, o.items, o.petIds)}`;
    if (family && word) return `Every ${family} ${word}`;
    return `All ${names.length}: ${listNames([...names.slice(0, 2), `${names.length - 2} more`], 'and')}`;
  }
  const label = page ? `${shortPage(page)} ${pageNoun(page, o.items, o.petIds)}` : family ? `${family} ${word ?? 'unique'}` : word ? word : null;
  if (label) {
    if (n === 1) return label[0].toUpperCase() + label.slice(1);
    return `${n} ${o.distinct ? 'different ' : ''}${plural(label)}`;
  }
  const head = listNames([...names.slice(0, 2), `${names.length - 2} more`]);
  if (n === 1) return head;
  return o.distinct ? `${n} different: ${head}` : `${n} × ${head}`;
}
