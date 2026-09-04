import npcDrops from '@/data/npcDrops.json'; // regenerate with `npm run data:drops`
import skillPets from '@/data/skillPets.json';
import clogData from '@/data/clog.json';
import { clogPageNames } from '@/lib/clogDataset';

// Two facts about a drop that only the SERVER can know, shipped to the plugin on /api/plugin/config.
//
// The plugin writes the Discord post, but it cannot answer either of these from what the game tells
// it. The game says "you received X" and, separately, "you have a funny feeling" — never which
// monster owed you the item, nor whether that monster owed it to you on *every* kill. Both answers
// live in the wiki drop dataset this repo already ships, so they belong here: a new boss or a
// corrected rate becomes `npm run data:drops`, not a plugin release waiting on a hub review.
//
//   PETS       — a pet drop fires no loot event, so the plugin has been attributing it to whatever
//                loot it happened to see last. That is the chest for a raid pet and, worse, a minion
//                or an unrelated kill for anything else. The pet's own NAME is the reliable key: a
//                Baby mole comes from the Giant Mole and from nothing else.
//   GUARANTEED — an item the source drops every time is not a spoon, and "someone drier deserved
//                that" under a guaranteed ornament kit reads as a bot that doesn't know the game.
//                The wiki marks these "Always", which the drop generator stores as 1-in-1.
//
// Both maps are keyed by lowercased NAME. The plugin already matches drops by name (its allowlist
// does), names survive an item-id variant swap, and it keeps a /config response readable when
// someone is looking at one wondering why a post said what it said.

interface DropEntry {
  i: number; // item id
  d: number; // 1-in-d per roll
  q?: number;
  m?: number;
  n?: number;
  r?: number;
}

const drops = npcDrops as unknown as Record<string, DropEntry[]>;
const activities = (clogData as { activities?: Record<string, { id: number; name: string }[]> }).activities ?? {};

/** The pages that answer "which pet is this?" rather than "where did it come from?". */
const PET_INDEX_PAGES = new Set(['All Pets', 'Skilling Pets']);

/**
 * A wiki source carrying a section anchor ("Yama#Contract") names a VARIANT of the fight, not the
 * fight itself. Anchored keys are inert to every other lookup in the app (which asks for plain boss
 * names) and must stay separate here too: the Contract hands out the Oathplate set outright while
 * the ordinary kill rolls it at 1/600. See the matching split in scripts/build-drops-dataset.mjs.
 */
function baseSource(source: string): string {
  return source.split('#')[0].trim();
}

export interface PetFact {
  /** Every source that drops this pet. Empty for a skilling pet — there is no monster. */
  sources: string[];
  /** 'npc' = killable (the plugin gets a rate and a KC); 'event' = raid/minigame; 'skill' = neither. */
  kind: 'npc' | 'event' | 'skill';
  /** For a skilling pet, the skill it comes from — the only true thing there is to say. */
  skill?: string;
}

let petCache: Record<string, PetFact> | null = null;
let guaranteedByIdCache: Map<number, string[]> | null = null;

/**
 * Pet name → where it actually comes from.
 *
 * Three sources of truth, ordered by how much the plugin can do with the answer:
 *
 *   1. the DROP DATASET — a killable monster with a rate, so the post gets a real rarity and kill
 *      count. Most pets. It is also the only one that can name SEVERAL monsters: a Vet'ion jr. comes
 *      off Vet'ion or Calvar'ion, and which one it was is the plugin's to disambiguate.
 *   2. the COLLECTION LOG page — raids and minigames have no kill table, but the log files their pet
 *      under the content ("Olmlet" sits on Chambers of Xeric). Names the content; no rate.
 *   3. skillPets.json — a skilling pet has no monster at all, and inventing one would be worse than
 *      a shorter post, so it carries the skill and no source.
 */
export function petFacts(): Record<string, PetFact> {
  if (petCache) return petCache;

  const byItem = new Map<number, string[]>();
  for (const [source, entries] of Object.entries(drops)) {
    const base = baseSource(source);
    for (const entry of entries) {
      const list = byItem.get(entry.i);
      if (list) {
        if (!list.includes(base)) list.push(base);
      } else {
        byItem.set(entry.i, [base]);
      }
    }
  }

  // Pet id → the content page it is filed under, ignoring the two pages that are only indexes of
  // pets. That is what turns an Olmlet into "Chambers of Xeric".
  const pageOfPet = new Map<number, string>();
  for (const page of clogPageNames()) {
    if (PET_INDEX_PAGES.has(page)) continue;
    for (const item of activities[page] ?? []) {
      if (!pageOfPet.has(item.id)) pageOfPet.set(item.id, page);
    }
  }

  const skillOfPet = new Map<string, string>();
  for (const [skill, names] of Object.entries((skillPets as { skills?: Record<string, string[]> }).skills ?? {})) {
    for (const name of names) skillOfPet.set(name.toLowerCase(), skill);
  }

  const facts: Record<string, PetFact> = {};
  for (const pet of activities['All Pets'] ?? []) {
    const key = pet.name.toLowerCase();
    const killable = byItem.get(pet.id);
    if (killable && killable.length > 0) {
      facts[key] = { sources: [...killable].sort(), kind: 'npc' };
      continue;
    }
    const page = pageOfPet.get(pet.id);
    if (page) {
      facts[key] = { sources: [page], kind: 'event' };
      continue;
    }
    // No monster and no page: a skilling pet, or something the catalogue hasn't placed yet. Either
    // way the honest answer is no source, and the plugin omits the field rather than guessing.
    const skill = skillOfPet.get(key);
    facts[key] = skill ? { sources: [], kind: 'skill', skill } : { sources: [], kind: 'skill' };
  }

  petCache = facts;
  return facts;
}

/**
 * Item id → the sources that drop it EVERY time.
 *
 * An item counts as guaranteed from a source only when every line the wiki files under that source
 * is an always-drop. Yama is why: the Contract hands out an Oathplate helm outright while the
 * ordinary fight rolls it at 1/600, and until the dataset is regenerated with the variant fix both
 * land under "Yama". Requiring EVERY line to be guaranteed makes that ambiguity read as "not
 * guaranteed", which is the safe direction — a rare drop wrongly called guaranteed loses the moment
 * entirely, while a guaranteed drop wrongly called rare is only the noise we have today.
 *
 * Held by id and never shipped whole: it covers every bone and pile of ashes in the game. The
 * payload is projected from it (see {@link dropFacts}).
 */
function guaranteedSourcesByItemId(): Map<number, string[]> {
  if (guaranteedByIdCache) return guaranteedByIdCache;

  const rates = new Map<string, Map<number, number[]>>();
  for (const [source, entries] of Object.entries(drops)) {
    const base = baseSource(source);
    let bySource = rates.get(base);
    if (!bySource) rates.set(base, (bySource = new Map()));
    for (const entry of entries) {
      const list = bySource.get(entry.i);
      if (list) list.push(entry.d);
      else bySource.set(entry.i, [entry.d]);
    }
  }

  const out = new Map<number, string[]>();
  for (const [source, byItem] of rates) {
    for (const [itemId, list] of byItem) {
      if (!list.every((d) => d === 1)) continue;
      const sources = out.get(itemId);
      if (sources) sources.push(source);
      else out.set(itemId, [source]);
    }
  }
  for (const sources of out.values()) sources.sort();

  guaranteedByIdCache = out;
  return out;
}

/**
 * Guarantees the wiki drop tables cannot express, because the content has no kill table: a raid
 * rolls its chest, so the chest's always-drops are filed under it and marked "reward" rather than
 * "combat" (see scripts/build-drops-dataset.mjs). Seeded with the raid kit a clear hands over every
 * time — the Tombs kit is given, while the Chambers and Theatre kits are rolled and stay out.
 * A clan extends this with the `guaranteed_drops` setting rather than editing the file.
 */
export const GUARANTEED_SUPPLEMENT: Record<string, string[]> = {
  'menaphite ornament kit': ['tombs of amascut'],
};

/** Item name → the sources it is guaranteed from, lowercased. `["*"]` = "wherever it drops". */
export type GuaranteedDrops = Record<string, string[]>;

export interface DropFacts {
  pets: Record<string, PetFact>;
  guaranteed: GuaranteedDrops;
}

/**
 * The guaranteed map, projected down to the items a post could ever be ABOUT.
 *
 * A guaranteed drop can never trip the rarity gate — its rarity is 1 — so the only ways it reaches
 * Discord are the value gate and the always-notify allowlist. Passing in just those names keeps the
 * payload to the handful that can matter instead of several hundred rows of bones and ashes nobody
 * was going to be congratulated for.
 *
 * @param nameOf item id → display name, for every item worth naming. Ids it can't name are dropped.
 */
export function guaranteedDropsFor(nameOf: (itemId: number) => string | null | undefined): GuaranteedDrops {
  const out: GuaranteedDrops = {};
  for (const [itemId, sources] of guaranteedSourcesByItemId()) {
    const name = nameOf(itemId);
    if (!name) continue;
    out[name.toLowerCase()] = sources.map((s) => s.toLowerCase());
  }
  return { ...out, ...GUARANTEED_SUPPLEMENT };
}

/**
 * Parse the clan's `guaranteed_drops` setting: one per line, `item name` or
 * `item name | source, source`.
 *
 * A bare name means "guaranteed wherever it drops", which is what a host reaching for this almost
 * always means and what makes it usable without knowing how the wiki files a source.
 */
export function parseGuaranteedOverrides(raw: string | null | undefined): GuaranteedDrops {
  const out: GuaranteedDrops = {};
  for (const line of (raw ?? '').split('\n')) {
    const [rawName, rawSources] = line.split('|');
    const name = rawName?.trim().toLowerCase();
    if (!name) continue;
    const sources = (rawSources ?? '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    out[name] = sources.length > 0 ? sources : ['*'];
  }
  return out;
}
