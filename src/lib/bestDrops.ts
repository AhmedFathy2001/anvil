// A competition's best drops: the handful worth remembering out of everything its feed kept.
//
// The feed (lib/competitionView loadHighlights) is newest first, so a pet from Monday has scrolled
// away by Wednesday, and it carries deaths. This is the other reading of the same rows: ranked by
// what they were, kept for the whole competition and shown again in its results.
//
// PURE. The rows are moments already attached to the competition at ingest (lib/moments
// weeklyKindFor), read by lib/momentsStore bestDropMoments.

export interface DropMoment {
  id: number;
  rsn: string;
  /** 'pet' | 'unique' | 'loot' are drops. Anything else (a death, a level, a combat task) is not. */
  kind: string;
  itemId: number | null;
  itemName: string | null;
  quantity?: number | null;
  valueGp: number | null;
  kc: number | null;
  rarityDenominator: number | null;
  occurredAt: string;
}

export interface BestDrop {
  /** Person and item: the line's identity. */
  key: string;
  rsn: string;
  pet: boolean;
  itemId: number | null;
  itemName: string;
  /** How many times this person got it during the competition. */
  count: number;
  /** 1 in N, when the drop table knows. */
  rarity: number | null;
  /** Kill count at the (first) drop, when the report carried one. */
  kc: number | null;
  valueGp: number | null;
  /** When they first got it. */
  occurredAt: string;
}

const DROP_KINDS = new Set(['pet', 'unique', 'loot']);
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

/** How many lines show before "Show all N". */
export const BEST_DROPS_SHOWN = 5;
/** How many go in a results post. */
export const BEST_DROPS_IN_RESULTS = 3;

/**
 * Rank a competition's drops, best first.
 *
 *   1. pets, always: a pet is the thing people open the page for;
 *   2. then by rarity, rarest first, a drop with a known rate ahead of one without;
 *   3. then by value, dearest first;
 *   4. then whoever got theirs first, then by name, so the order is the same on every load.
 *
 * Deaths and every other non-drop kind are left out. One line per person and item: the same item
 * twice is one line with a count, carrying the rarity, value and kill count of its best sighting
 * and the time of its first.
 */
export function rankBestDrops(moments: readonly DropMoment[]): BestDrop[] {
  const lines = new Map<string, BestDrop>();
  for (const m of moments) {
    if (!DROP_KINDS.has(m.kind)) continue;
    // A pet the plugin could not name is still a pet; anything else with no name is nothing to show.
    const name = m.itemName?.trim() || (m.kind === 'pet' ? 'A pet' : null);
    if (!name) continue;
    const key = `${norm(m.rsn)}|${m.itemId ?? norm(name)}`;
    const at = Date.parse(m.occurredAt);
    const line = lines.get(key);
    if (!line) {
      lines.set(key, {
        key,
        rsn: m.rsn,
        pet: m.kind === 'pet',
        itemId: m.itemId,
        itemName: name,
        count: 1,
        rarity: m.rarityDenominator && m.rarityDenominator > 1 ? m.rarityDenominator : null,
        kc: m.kc && m.kc > 0 ? m.kc : null,
        valueGp: m.valueGp && m.valueGp > 0 ? m.valueGp : null,
        occurredAt: m.occurredAt,
      });
      continue;
    }
    line.count += 1;
    line.pet ||= m.kind === 'pet';
    if (m.rarityDenominator && m.rarityDenominator > (line.rarity ?? 1)) line.rarity = m.rarityDenominator;
    if (m.valueGp && m.valueGp > (line.valueGp ?? 0)) line.valueGp = m.valueGp;
    if (Number.isFinite(at) && at < Date.parse(line.occurredAt)) {
      line.occurredAt = m.occurredAt;
      if (m.kc && m.kc > 0) line.kc = m.kc;
    } else if (line.kc == null && m.kc && m.kc > 0) {
      line.kc = m.kc;
    }
  }
  return [...lines.values()].sort(
    (a, b) =>
      Number(b.pet) - Number(a.pet) ||
      (b.rarity ?? 0) - (a.rarity ?? 0) ||
      (b.valueGp ?? 0) - (a.valueGp ?? 0) ||
      Date.parse(a.occurredAt) - Date.parse(b.occurredAt) ||
      a.rsn.localeCompare(b.rsn),
  );
}

/** "1 in 5,000 · at 1,204 kc": the facts under a line, without the time. Empty when it has neither. */
export function bestDropFacts(d: Pick<BestDrop, 'rarity' | 'kc'>): string[] {
  const out: string[] = [];
  if (d.rarity) out.push(`1 in ${d.rarity.toLocaleString('en-US')}`);
  if (d.kc) out.push(`at ${d.kc.toLocaleString('en-US')} kc`);
  return out;
}

/** "Lcl Member · Pet snakeling ×2 (1 in 4,000, at 1,204 kc)": one line of a results post. */
export function bestDropLine(d: BestDrop): string {
  const facts = bestDropFacts(d);
  return `**${d.rsn}** · ${d.itemName}${d.count > 1 ? ` ×${d.count}` : ''}${facts.length ? ` (${facts.join(', ')})` : ''}`;
}
