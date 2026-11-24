// Which of a guide's setups a player is wearing, for the automatic "used it" (lib/guideAutoUsed):
// the plugin pushed the worn gear, then a kill on the guide's boss. PURE.

/** A setup as the matcher sees it: its vote key, its gear by slot, and each slot's listed fallbacks. */
export interface WornSetup {
  key: string;
  gear: Record<string, number>;
  alts?: Partial<Record<string, number[]>>;
}

/** A setup naming fewer slots than this is too thin to tell apart from any other gear. */
export const AUTO_USED_MIN_SLOTS = 3;
/** The share of a setup's named slots that must be worn (its item, an equivalent or a listed fallback). */
export const AUTO_USED_SHARE = 0.75;

/**
 * The key of the setup `worn` matches best, or null when none matches well enough: the weapon worn
 * (when the setup names one) and at least AUTO_USED_SHARE of its named slots. A tie goes to the setup
 * with more slots worn, then the first. `same` gives an item's equivalents — lib/itemFamilies
 * equivalentsFor, the same families ownership uses (kits, recolours, imbued and charged forms count as
 * their base); without it only the exact id counts.
 */
export function matchWornSetup(worn: Iterable<number>, setups: WornSetup[], same: (id: number) => number[] = (id) => [id]): string | null {
  const have = new Set<number>();
  for (const id of worn) for (const x of same(id)) have.add(x);
  let best: { key: string; share: number; hit: number } | null = null;
  for (const s of setups) {
    const slots = Object.entries(s.gear).filter(([, id]) => Number.isInteger(id) && id > 0);
    if (slots.length < AUTO_USED_MIN_SLOTS) continue;
    const worn = (slot: string, id: number) => [id, ...(s.alts?.[slot] ?? [])].some((x) => have.has(x));
    if (s.gear.weapon > 0 && !worn('weapon', s.gear.weapon)) continue;
    const hit = slots.filter(([slot, id]) => worn(slot, id)).length;
    const share = hit / slots.length;
    if (share < AUTO_USED_SHARE) continue;
    if (!best || share > best.share || (share === best.share && hit > best.hit)) best = { key: s.key, share, hit };
  }
  return best?.key ?? null;
}
