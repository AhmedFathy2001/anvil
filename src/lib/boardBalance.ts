// Structural board-balance analysis — Phase 1 of the balance auditor. Everything here
// derives from the tiles alone (no rate datasets): tier shape, category concentration,
// kind mix, luck exposure, manual-verification burden, and blank-tile hygiene. Phase 2
// adds the effort model (points per expected hour with a fast/average/slow skill spread
// and accessibility floors) on top of curated + learned rate tables.
//
// Pure and client-safe: the Tiles tab recomputes the report live as tiles change.

import type { Tile } from '@/lib/types';
import { splitCategories, tileTierKey, tierColor, DEFAULT_TIER_BANDS, type TierBand } from '@/lib/tileFilter';
import { tileWeight } from '@/lib/utils';

export type BalanceLevel = 'ok' | 'info' | 'warn';

export interface BalanceCheck {
  id: string;
  level: BalanceLevel;
  title: string;
  detail: string;
  /** Tiles this check points at, for future click-to-filter affordances. */
  tileIds?: number[];
}

export interface BalanceShare {
  label: string;
  weight: number;
  share: number; // 0..1 of totalWeight
}

export interface BalanceReport {
  totalWeight: number;
  tileCount: number;
  /** Per-band tile counts + weight, in ascending band order, with the indicator colour. */
  tierHistogram: { key: string; label: string; color: string; tiles: number; weight: number }[];
  /** Weight share per category tag (multi-tag tiles count toward each tag), desc. */
  categoryShares: BalanceShare[];
  /** Weight share per mechanic family, desc. */
  kindShares: BalanceShare[];
  /** Share of weight behind pure drop-RNG (drops, item sets, single-haul value). */
  luckShare: number;
  /** Share of weight on manual tiles (captain-verified, no auto-tracking). */
  manualShare: number;
  checks: BalanceCheck[];
}

// Mechanic families for the kind mix. Grouped by how a tile is EARNED, which is what
// balance cares about: RNG rolls, deterministic grind, execution skill, or a human.
function kindFamily(t: Tile): 'RNG drops' | 'Grind' | 'Execution' | 'Manual' {
  const type = t.tileType ?? 'standard';
  if (type === 'drop' || type === 'value') return 'RNG drops';
  if (type === 'timed' || type === 'lms' || type === 'deathless') return 'Execution';
  // CA tiles sit with Execution — completing a combat task is a mechanics test, not a grind.
  if (type === 'ca') return 'Execution';
  // PvP kills are a mechanics (and bravery) test — hunting players, not a grind.
  if (type === 'pvp') return 'Execution';
  // Agility laps are the purest grind on the board — no roll, no mechanics check, just time.
  if (type === 'kill' || type === 'lap' || type === 'gain' || type === 'diary' || type === 'valuetotal') return 'Grind';
  if (t.trackedStat) return 'Grind'; // hiscores-polled skill/boss tiles store tileType 'standard'
  return 'Manual';
}

const BLANK_LABEL = /^Tile \d+$/;

export function analyzeBoard(
  tiles: Tile[],
  opts: { pointsMode: boolean; tierBands?: TierBand[] },
): BalanceReport {
  const bands = (opts.tierBands && opts.tierBands.length > 0 ? [...opts.tierBands] : [...DEFAULT_TIER_BANDS])
    .sort((a, b) => a.min - b.min);
  const scoringMode = opts.pointsMode ? 'points' : 'tiles';
  // Optional tiles don't count toward standings, so they don't count toward balance either.
  const scored = tiles.filter((t) => !t.optional);
  const weightOf = (t: Tile) => tileWeight(scoringMode, t.points ?? 1);
  const totalWeight = scored.reduce((sum, t) => sum + weightOf(t), 0);

  // ---- Tier histogram (points mode only — bands derive from point values) ----
  const tierHistogram = bands.map((b, i) => ({
    key: b.key,
    label: b.label,
    color: tierColor(i, bands.length),
    tiles: 0,
    weight: 0,
  }));
  if (opts.pointsMode) {
    const byKey = new Map(tierHistogram.map((h) => [h.key, h]));
    for (const t of scored) {
      const key = tileTierKey(t.points, bands);
      const bucket = key ? byKey.get(key) : undefined;
      if (bucket) {
        bucket.tiles += 1;
        bucket.weight += weightOf(t);
      }
    }
  }

  // ---- Category shares (multi-tag: a tile's full weight counts toward each of its tags) ----
  const catWeight = new Map<string, { label: string; weight: number }>();
  let untaggedWeight = 0;
  for (const t of scored) {
    const tags = splitCategories(t.category);
    if (tags.length === 0) {
      untaggedWeight += weightOf(t);
      continue;
    }
    for (const tag of tags) {
      const key = tag.toLowerCase();
      const cur = catWeight.get(key) ?? { label: tag, weight: 0 };
      cur.weight += weightOf(t);
      catWeight.set(key, cur);
    }
  }
  const categoryShares: BalanceShare[] = [...catWeight.values()]
    .map((c) => ({ label: c.label, weight: c.weight, share: totalWeight ? c.weight / totalWeight : 0 }))
    .sort((a, b) => b.weight - a.weight);

  // ---- Kind mix / luck / manual ----
  const famWeight = new Map<string, number>();
  for (const t of scored) {
    const fam = kindFamily(t);
    famWeight.set(fam, (famWeight.get(fam) ?? 0) + weightOf(t));
  }
  const kindShares: BalanceShare[] = [...famWeight.entries()]
    .map(([label, weight]) => ({ label, weight, share: totalWeight ? weight / totalWeight : 0 }))
    .sort((a, b) => b.weight - a.weight);
  const luckShare = totalWeight ? (famWeight.get('RNG drops') ?? 0) / totalWeight : 0;
  const manualShare = totalWeight ? (famWeight.get('Manual') ?? 0) / totalWeight : 0;

  // ---- Checks ----
  const checks: BalanceCheck[] = [];
  const pct = (x: number) => `${Math.round(x * 100)}%`;

  const blanks = tiles.filter((t) => (t.tileType ?? 'standard') === 'standard' && !t.trackedStat && BLANK_LABEL.test(t.label ?? ''));
  if (blanks.length > 0) {
    checks.push({
      id: 'blank-tiles',
      level: 'warn',
      title: `${blanks.length} blank tile${blanks.length === 1 ? '' : 's'}`,
      detail: 'Unconfigured "Tile N" rows still on the board — configure or delete them before the event starts.',
      tileIds: blanks.map((t) => t.id),
    });
  }

  if (totalWeight > 0 && untaggedWeight / totalWeight > 0.3 && scored.length >= 8) {
    checks.push({
      id: 'untagged',
      level: 'info',
      title: `${pct(untaggedWeight / totalWeight)} of the board is uncategorised`,
      detail: 'Tag tiles (e.g. "PvM, Zulrah" / "Skilling, Cooking") so filters and the category balance read correctly.',
    });
  }

  const topCat = categoryShares[0];
  if (topCat && topCat.share > 0.4 && scored.length >= 8) {
    checks.push({
      id: 'category-concentration',
      level: 'warn',
      title: `"${topCat.label}" holds ${pct(topCat.share)} of the board`,
      detail: 'One content type dominates — players who don\'t enjoy it have little to contribute. Consider spreading weight across more categories.',
    });
  }

  if (scored.length >= 8) {
    if (luckShare > 0.6) {
      checks.push({
        id: 'luck-exposure',
        level: 'warn',
        title: `${pct(luckShare)} of the board is pure drop RNG`,
        detail: 'Standings will swing on luck rather than effort. Mix in grind tiles (XP, kill counts, gains) or execution tiles (timed, deathless) to reward play time.',
      });
    } else if (luckShare > 0.4) {
      checks.push({
        id: 'luck-exposure',
        level: 'info',
        title: `${pct(luckShare)} of the board is drop RNG`,
        detail: 'A healthy chunk of the outcome rides on drop luck — fine if intended, worth knowing either way.',
      });
    }
  }

  if (manualShare > 0.25 && scored.length >= 8) {
    checks.push({
      id: 'manual-heavy',
      level: 'info',
      title: `${pct(manualShare)} of the board needs manual verification`,
      detail: 'Manual tiles put the completion burden on captains/admins. The plugin can auto-track drops, XP, kills, gains, timed clears, diaries, LMS and loot values.',
    });
  }

  if (opts.pointsMode && scored.length >= 8) {
    const third = Math.max(1, Math.floor(bands.length / 3));
    const bottom = tierHistogram.slice(0, third).reduce((s, h) => s + h.tiles, 0);
    const top = tierHistogram.slice(-third).reduce((s, h) => s + h.tiles, 0);
    if (top > bottom) {
      checks.push({
        id: 'tier-shape',
        level: 'warn',
        title: 'Top-heavy tier shape',
        detail: `More tiles sit in the top band${third > 1 ? 's' : ''} (${top}) than the bottom (${bottom}). Healthy boards are a pyramid — plenty of small tiles keep casual players contributing between big sends.`,
      });
    }

    const distinct = new Set(scored.map((t) => t.points ?? 1));
    if (distinct.size === 1 && scored.length >= 8) {
      checks.push({
        id: 'flat-points',
        level: 'info',
        title: 'Every tile is worth the same points',
        detail: 'On a points board, flat values make it a tile-count race — use the difficulty tiers to weight harder tiles higher.',
      });
    }
  }

  if (checks.length === 0 && scored.length > 0) {
    checks.push({
      id: 'all-clear',
      level: 'ok',
      title: 'No structural warnings',
      detail: 'Tier shape, category spread, luck exposure and configuration hygiene all look reasonable. (Points-per-hour auditing lands with the effort model.)',
    });
  }

  return { totalWeight, tileCount: scored.length, tierHistogram, categoryShares, kindShares, luckShare, manualShare, checks };
}
