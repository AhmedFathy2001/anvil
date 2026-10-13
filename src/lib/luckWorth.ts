// Which drops are worth calling somebody lucky or dry over.
//
// Rarity alone is the wrong test. A 1-in-1,250 keris jewel is rarer than most boss uniques and
// nobody has ever cared about one; a 1-in-128 Dragon chainbody from the Kalphite Queen is a stack of
// alch money. A luck board full of those is a board of noise, and it pushes the drops a clan actually
// talks about off the bottom.
//
// So a candidate has to MATTER as well as be rare (the rarity floor is clogLuckBoard's):
//
//   pets and jars        always — nobody needs a price to know a pet is a story;
//   anything with a GE price   only at or above the clan's floor (default 1M);
//   anything with no price     unless it is on the ignore list below. "No price" is not "junk":
//                              the wiki's price feed has no line for several real uniques
//                              (vestiges, quartzes, mutagens), so the junk is named instead.
//
// Pure: prices come in as a map, so the rule is testable without the network.

export const LUCK_VALUE_FLOOR_SETTING_KEY = 'luck_value_floor';
export const DEFAULT_LUCK_VALUE_FLOOR = 1_000_000;

/**
 * Untradeable or unpriced drops that are rare and worthless: cosmetics nobody chases, and trophy
 * heads that hand out with every hundredth kill. By name, lowercased, so a dataset regeneration that
 * moves an id does not quietly let one back in.
 */
export const LUCK_IGNORED_ITEMS: ReadonlySet<string> = new Set([
  // Tombs of Amascut keris jewels and the invocation thread.
  'breach of the scarab',
  'eye of the corruptor',
  'jewel of amascut',
  'jewel of the sun',
  'thread of elidinis',
  // Trophy heads and totem pieces.
  'kbd heads',
  'kq head',
  'alchemical hydra heads',
  'dark totem',
  'parasitic egg',
]);

/** The clan's floor, from its setting; anything unparseable or non-positive falls back to the default. */
export function luckValueFloor(raw: string | null | undefined): number {
  const n = raw == null || raw.trim() === '' ? NaN : Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_LUCK_VALUE_FLOOR;
}

export function isPetOrJar(itemName: string, petIds: ReadonlySet<number>, itemId: number): boolean {
  return petIds.has(itemId) || /^jar of /i.test(itemName.trim());
}

/**
 * Does this drop count toward luck?
 *
 * `prices` empty means the price feed is unavailable: the value test is skipped rather than failing
 * every item, and only the ignore list applies — a board with a little noise beats an empty one.
 */
export function worthCounting(
  item: { itemId: number; itemName: string },
  ctx: { prices: ReadonlyMap<number, number>; floor: number; petIds: ReadonlySet<number> },
): boolean {
  if (isPetOrJar(item.itemName, ctx.petIds, item.itemId)) return true;
  if (LUCK_IGNORED_ITEMS.has(item.itemName.trim().toLowerCase())) return false;
  if (ctx.prices.size === 0) return true;
  const price = ctx.prices.get(item.itemId);
  return price == null || price >= ctx.floor;
}
