import bossCategories from '@/data/bossCategories.json';
import slayerMonsters from '@/data/slayerMonsters.json';
import { BOSSES } from '@/lib/constants';

/**
 * Bulk KC-tile authoring: every boss you pick × every threshold you type.
 *
 * A board that asks for 25/50/100/200 kills of twenty bosses is eighty tiles, and building it by
 * hand is eighty trips through the editor for what is really two lists. This turns the two lists
 * into the rows, and does it as a pure function so the shape of what gets created is pinned by a
 * test rather than discovered on a live board.
 *
 * Imports only the shipped datasets, no database — same rule as lib/moments and lib/teamInvites.
 */

export interface BossOptionView {
  key: string;
  label: string;
}

export interface BossCategoryView {
  key: string;
  label: string;
  blurb: string;
  bosses: BossOptionView[];
}

const raw = bossCategories as {
  categories?: { key: string; label: string; blurb: string; bosses: string[] }[];
};

/**
 * The filters, in file order, with everything unplaced gathered into "Other".
 *
 * Other is not a leftovers bin to be tidied away: the game adds bosses faster than anyone updates a
 * taxonomy, and a boss missing from the picker entirely is a worse bug than one filed vaguely.
 */
export function bossCategoryViews(): BossCategoryView[] {
  const byKey = new Map(BOSSES.map((b) => [b.key, b.label]));
  const placed = new Set<string>();
  const out: BossCategoryView[] = [];

  for (const cat of raw.categories ?? []) {
    const bosses: BossOptionView[] = [];
    for (const key of cat.bosses) {
      const label = byKey.get(key);
      // A key the boss list no longer has (renamed, retired) is skipped rather than rendered as a
      // checkbox that generates a tile nothing can ever track.
      if (!label) continue;
      placed.add(key);
      bosses.push({ key, label });
    }
    if (bosses.length > 0) out.push({ key: cat.key, label: cat.label, blurb: cat.blurb, bosses });
  }

  const rest = BOSSES.filter((b) => !placed.has(b.key)).map((b) => ({ key: b.key, label: b.label }));
  if (rest.length > 0) {
    out.push({
      key: 'other',
      label: 'Other',
      blurb: 'Everything not filed above — newer bosses land here first.',
      bosses: rest,
    });
  }
  return out;
}


export interface MonsterOptionView {
  name: string;
  slayerLevel: number | null;
  combatLevel: number | null;
}

export interface MonsterCategoryView {
  key: string;
  label: string;
  monsters: MonsterOptionView[];
}

const slayerRaw = slayerMonsters as {
  categories?: { label: string; monsters: MonsterOptionView[] }[];
};

/**
 * Slayer task groups and what's in them (src/data/slayerMonsters.json, `npm run data:slayer`).
 *
 * The hiscores count nothing below a boss, so none of this can come from a stat sweep — it comes
 * from the wiki's own monster infoboxes, which is also why it stays a shipped file rather than a
 * hand-kept list: the game adds monsters, and a regen picks them up.
 */
export function monsterCategoryViews(): MonsterCategoryView[] {
  return (slayerRaw.categories ?? []).map((c) => ({
    key: c.label.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    label: c.label,
    monsters: c.monsters,
  }));
}

/** Every monster name we know — the picker's search, and a check on a pasted list. */
export function knownMonsterNames(): Set<string> {
  const out = new Set<string>();
  for (const c of slayerRaw.categories ?? []) for (const m of c.monsters) out.add(m.name);
  return out;
}

/**
 * Parse the thresholds field: "25, 50, 100, 200".
 *
 * Newlines and spaces count as separators too, because the list is usually pasted from somewhere.
 * Duplicates collapse and the result is sorted, so "100, 25, 25, 50" is the board the host meant.
 */
export function parseThresholds(text: string, max = 100_000): number[] {
  const seen = new Set<number>();
  for (const part of text.split(/[\s,]+/)) {
    if (!part) continue;
    if (!/^\d+$/.test(part)) return [];
    const n = parseInt(part, 10);
    if (!Number.isFinite(n) || n < 1 || n > max) return [];
    seen.add(n);
  }
  return [...seen].sort((a, b) => a - b);
}

/**
 * Points for each threshold.
 *
 * One number applies to every tile. A list has to line up with the thresholds — "10, 20, 40, 80"
 * against "25, 50, 100, 200" — because a mismatch means the host meant something we can't guess,
 * and silently reusing the last value would price a 200-KC tile like a 25-KC one.
 */
export function parsePoints(text: string, thresholdCount: number): number[] | null | 'mismatch' {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(/[\s,]+/).filter(Boolean);
  const nums: number[] = [];
  for (const p of parts) {
    if (!/^\d+$/.test(p)) return 'mismatch';
    nums.push(parseInt(p, 10));
  }
  if (nums.length === 1) return Array(thresholdCount).fill(nums[0]);
  return nums.length === thresholdCount ? nums : 'mismatch';
}

export interface GeneratedTileRow {
  label: string;
  tileType: string;
  description: string;
  category: string;
  trackedStat?: string;
  statType?: string;
  statGoal?: number;
  targetNpcs?: string[];
  requiredAmount?: number;
  points?: number;
}

/**
 * Boss KC tiles: one per (boss × threshold).
 *
 * Ordered boss-major — every threshold for Zulrah, then every threshold for Vorkath — because that
 * is how they read on the board and how someone checks the batch was right before saving it.
 *
 * Tagged "Bossing, <Boss>" to match the skill generator's "Skilling, <Skill>", so a tile lands under
 * both the broad filter and its own.
 */
export function bossKcRows(input: {
  bosses: BossOptionView[];
  thresholds: number[];
  points: number[] | null;
}): GeneratedTileRow[] {
  const rows: GeneratedTileRow[] = [];
  for (const boss of input.bosses) {
    input.thresholds.forEach((goal, i) => {
      rows.push({
        label: `${goal.toLocaleString()} ${boss.label} KC`,
        tileType: 'standard',
        trackedStat: boss.key,
        statType: 'boss',
        statGoal: goal,
        category: `Bossing, ${boss.label}`,
        description: `Reach ${goal.toLocaleString()} ${boss.label} kill count during the event.`,
        ...(input.points ? { points: input.points[i] } : {}),
      });
    });
  }
  return rows;
}

/**
 * Kill tiles for anything the hiscores don't count — slayer monsters, and any other NPC.
 *
 * These credit off the plugin's own kill signal rather than a hiscores sweep, so they work for
 * abyssal demons and cows alike. The NPC name is passed through as the host typed it: it is matched
 * case-insensitively against what the client reports, and inventing a "correction" here would break
 * exactly the unusual names this exists to support.
 */
export function npcKillRows(input: {
  npcs: string[];
  thresholds: number[];
  points: number[] | null;
  category: string;
}): GeneratedTileRow[] {
  const rows: GeneratedTileRow[] = [];
  for (const npc of input.npcs) {
    input.thresholds.forEach((amount, i) => {
      rows.push({
        label: `${amount.toLocaleString()} ${npc}`,
        tileType: 'kill',
        targetNpcs: [npc],
        requiredAmount: amount,
        category: `${input.category}, ${npc}`,
        description: `Kill ${amount.toLocaleString()} ${npc} during the event.`,
        ...(input.points ? { points: input.points[i] } : {}),
      });
    });
  }
  return rows;
}

/** Split a pasted NPC list. Commas and newlines only — an NPC name has spaces in it. */
export function parseNpcList(text: string, max = 60): string[] {
  const seen = new Set<string>();
  for (const part of text.split(/[,\n]/)) {
    const name = part.trim();
    if (name) seen.add(name.slice(0, 60));
    if (seen.size >= max) break;
  }
  return [...seen];
}
