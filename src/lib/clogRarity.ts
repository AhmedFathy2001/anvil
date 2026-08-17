import npcDrops from '@/data/npcDrops.json'; // regenerate with `npm run data:drops`
import { clogItemNames, clogPageNames, clogPageOfItem } from '@/lib/clogDataset';

// How rare is a collection log slot, and where did it come from.
//
// The log itself never says. In game you learn an item's weight socially — someone tells you a
// twisted bow is 1 in 34 and a bronze defender is not — so a profile that renders 1,700 identical
// squares throws away the only thing that makes a log worth looking at. This puts the wiki's own
// numbers behind each slot, which is what lets the page lead with what someone actually owns rather
// than what fraction of a list they've ticked.

interface DropEntry {
  i: number; // item id
  d: number; // 1-in-d per roll
  r?: number; // rolls per kill
}

export interface ItemRarity {
  /** 1-in-N, from the content this item's log page is for. */
  denominator: number;
  /** The source those odds belong to — "1 in 5,000 from Zulrah" is the sentence. */
  source: string;
}

/**
 * Rarity tiers, chosen to match how players already talk. "Rare" is the pet-and-mega threshold
 * where people start announcing drops in clan chat; "notable" is where a drop is worth a message.
 * Everything below is the bulk of a log and stays quiet, or the shelf is meaningless.
 */
export type RarityTier = 'common' | 'notable' | 'rare' | 'ultra';

export const RARITY_THRESHOLDS: Record<Exclude<RarityTier, 'common'>, number> = {
  notable: 100,
  rare: 500,
  ultra: 2000,
};

export function tierFor(denominator: number | undefined): RarityTier {
  if (!denominator || denominator < RARITY_THRESHOLDS.notable) return 'common';
  if (denominator >= RARITY_THRESHOLDS.ultra) return 'ultra';
  if (denominator >= RARITY_THRESHOLDS.rare) return 'rare';
  return 'notable';
}

let rarityCache: Map<number, ItemRarity> | null = null;

/**
 * Item id → the drop rate that actually means something for it.
 *
 * The rate is taken from the source its LOG PAGE is for, not from the rarest table it appears in
 * anywhere. Those are wildly different claims: a dragon spear is 1 in 2.8 million off some
 * incidental NPC and nobody has ever bragged about that, while the number people quote for a
 * twisted bow is the one from Chambers of Xeric. Ranking on the first produces a shelf of trivia.
 *
 * An item whose page has no per-kill table — clue pages, minigames — has no rate here, and so never
 * appears on the shelf. A shelf is a claim about how hard something was, and "we don't know" isn't
 * one.
 */
export function clogItemRarity(): Map<number, ItemRarity> {
  if (rarityCache) return rarityCache;

  const drops = npcDrops as unknown as Record<string, DropEntry[]>;
  const owner = clogPageOfItem();
  const out = new Map<number, ItemRarity>();

  for (const page of clogPageNames()) {
    const table = drops[page];
    if (!table) continue; // no per-kill table for this content
    for (const drop of table) {
      // Only for items this page actually owns, so a shared item is rated by its own boss.
      if (owner.get(drop.i) !== page) continue;
      if (!Number.isFinite(drop.d) || drop.d < RARITY_THRESHOLDS.notable) continue;
      const held = out.get(drop.i);
      if (!held || drop.d > held.denominator) out.set(drop.i, { denominator: drop.d, source: page });
    }
  }

  rarityCache = out;
  return out;
}

export interface ShowcaseItem {
  itemId: number;
  name: string;
  denominator: number;
  source: string;
  page: string;
  kcAtUnlock: number | null;
  firstSeenAt: string | null;
}

/**
 * The rarest things a member owns, hardest first — the shelf the page leads with.
 *
 * An item with no known rate simply isn't a candidate: a shelf is a claim about how hard something
 * was, and "we don't know" is not one. Ties break on the item they were obtained at, so a spooned
 * unlock outranks an identical grind.
 */
export function buildShowcase(
  owned: { itemId: number; kcAtUnlock: number | null; firstSeenAt: string | null }[],
  limit = 6,
): ShowcaseItem[] {
  const rarity = clogItemRarity();
  const names = clogItemNames();
  const pages = clogPageOfItem();

  return owned
    .map((item) => {
      const rate = rarity.get(item.itemId);
      if (!rate) return null;
      return {
        itemId: item.itemId,
        name: names.get(item.itemId) ?? `Item ${item.itemId}`,
        denominator: rate.denominator,
        source: rate.source,
        page: pages.get(item.itemId) ?? rate.source,
        kcAtUnlock: item.kcAtUnlock,
        firstSeenAt: item.firstSeenAt,
      };
    })
    .filter((x): x is ShowcaseItem => x !== null)
    .sort((a, b) => b.denominator - a.denominator || (a.kcAtUnlock ?? Infinity) - (b.kcAtUnlock ?? Infinity))
    .slice(0, limit);
}

// ── Page grouping ────────────────────────────────────────────────────────────────────────────────

export type PageGroup = 'Raids' | 'Bosses' | 'Clues' | 'Minigames' | 'Skilling' | 'Other';

const RAID_PAGES = new Set(['Chambers of Xeric', 'Theatre of Blood', 'Tombs of Amascut']);

const GROUP_PATTERNS: [PageGroup, RegExp][] = [
  ['Clues', /treasure trails|clue|shared/i],
  ['Minigames', /barbarian assault|castle wars|last man|soul wars|trouble brewing|pest control|mage arena|inferno|fight cave|colosseum|tzhaar|emir|rogue|brimhaven|hallowed|guardians of the rift|temple trekking|mahogany|magic training|shades of mort|volcanic mine|giants foundry|tithe|gnome restaurant|barrows/i],
  ['Skilling', /fishing|farming|hunter|mining|woodcut|thieving|agility|firemaking|smithing|crafting|runecraft|construction|cooking|slayer|motherlode|tempoross|wintertodt|zalcano|sepulchre|camdozaal|forestry|birdhouse|aerial|drift|blast/i],
];

/**
 * Which shelf a log page belongs on.
 *
 * The dataset ships no categories — the game's own tabs aren't in the wiki module — so this derives
 * them from the page's own name, with the boss list as the authority for anything that has a
 * hiscores counter. It is a navigation aid over 125 flat pages, not a taxonomy: a page landing in
 * "Other" costs a member one extra glance, which is why the fallback is a real group rather than a
 * guess.
 */
export function groupOf(page: string, bossLabels: Set<string>): PageGroup {
  if (RAID_PAGES.has(page)) return 'Raids';
  for (const [group, pattern] of GROUP_PATTERNS) {
    if (pattern.test(page)) return group;
  }
  if (bossLabels.has(page.toLowerCase())) return 'Bosses';
  return 'Other';
}

/** Display order: the content people brag about first, the miscellany last. */
export const GROUP_ORDER: PageGroup[] = ['Raids', 'Bosses', 'Minigames', 'Clues', 'Skilling', 'Other'];
