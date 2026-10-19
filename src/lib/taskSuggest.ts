// "What's the task?" — turn what an admin types into tiles that are already set up to track.
//
// The tile editor used to open on a grid of fifteen tile kinds, before the admin had said what the
// task was. People think "Zenyte shard" or "100 Zulrah", not "drop pool" or "boss KC stat tile", so
// a first board was mostly Standard tiles — the kind that never tracks — with real names on them.
// This answers the question the other way round: type the task, pick a suggestion, and the kind and
// its fields arrive filled in. The kind grid stays in the editor for anything this doesn't cover.
//
// Sources, best first: the clan's own task library and the starter tasks (already fully configured,
// including raids, pets and diaries), bosses (hiscores kill count), skills (XP gained), then single item drops.

import { BOSSES, SKILLS, SKILL_LABELS, SKILL_ALIASES } from '@/lib/constants';
import { getItemMapping, isDroppableItem, type MappingItem } from '@/lib/osrsItems';
import { SEED_TASKS, listLibrary } from '@/lib/tileLibrary';
import { normalizeSearch } from '@/lib/tileSearch';
import type { TileCsvRow } from '@/lib/csvTiles';
import type { TileConfig } from '@/lib/types';

export interface TaskSuggestion {
  key: string;
  source: 'library' | 'boss' | 'skill' | 'item';
  /** What the tile will be called. */
  title: string;
  /** How it counts, in a few words. */
  hint: string;
  /** The editor fields this fills in; everything not named keeps the tile's current value. */
  config: Partial<TileConfig>;
}

/**
 * A leading amount in the query: "100 zulrah", "5m fishing", "2.5k slayer". Returns the number and
 * the rest of the query, or a null amount when there is none.
 */
export function splitAmount(query: string): { amount: number | null; rest: string } {
  const m = query.trim().match(/^(\d+(?:[.,]\d+)?)\s*([km])?\b\s*(.*)$/i);
  if (!m) return { amount: null, rest: query.trim() };
  const n = parseFloat(m[1].replace(',', '.'));
  const mult = m[2]?.toLowerCase() === 'm' ? 1_000_000 : m[2]?.toLowerCase() === 'k' ? 1_000 : 1;
  return { amount: Math.round(n * mult), rest: m[3] };
}

function matchesAll(haystack: string, words: string[]): boolean {
  const h = normalizeSearch(haystack);
  return words.every((w) => h.includes(w));
}

function shortNumber(n: number): string {
  if (n >= 1_000_000 && n % 100_000 === 0) return `${n / 1_000_000}M`;
  if (n >= 1_000 && n % 100 === 0) return `${n / 1_000}k`;
  return n.toLocaleString('en-US');
}

/** A library row as editor fields. Item names resolve to ids here, the same way the importer does. */
export function rowToTileConfig(row: TileCsvRow, byName: Map<string, MappingItem>): Partial<TileConfig> | null {
  const cfg: Partial<TileConfig> = {
    tileType: !row.tileType || (row.tileType as string) === 'stat' ? 'standard' : row.tileType,
    requiredAmount: row.requiredAmount ?? null,
    trackedStat: row.trackedStat ?? null,
    statType: row.statType ?? null,
    statGoal: row.statGoal ?? null,
    statBasis: row.statBasis ?? 'gain',
    targetNpcs: row.targetNpcs ?? null,
    timedActivity: row.timedActivity ?? null,
    timeThresholdSeconds: row.timeThresholdSeconds ?? null,
    trackedItemIds: null,
    itemRequirements: null,
    countMode: row.countMode ?? null,
    perKillCap: row.perKillCap ?? null,
    groupMode: row.groupMode ?? null,
    setsRequired: row.setsRequired ?? null,
  };
  if (row.items && row.items.length > 0) {
    const resolved = row.items.map((it) => {
      const hit = it.id != null ? { id: it.id, name: it.name } : byName.get(it.name.trim().toLowerCase());
      return hit ? { itemId: hit.id, name: hit.name || it.name, requiredAmount: Math.max(1, it.count || 1), group: it.group ?? null } : null;
    });
    // An item name the catalogue doesn't know would leave a tile tracking nothing — skip the task.
    if (resolved.some((r) => r == null)) return null;
    const reqs = resolved as NonNullable<(typeof resolved)[number]>[];
    cfg.tileType = row.tileType === 'gain' ? 'gain' : 'drop';
    if (row.requiredAmount != null) {
      cfg.trackedItemIds = reqs.map((r) => r.itemId);
    } else if (reqs.length === 1) {
      // One item, a count: a simple drop pool reads better than a one-item collection.
      cfg.trackedItemIds = [reqs[0].itemId];
      cfg.requiredAmount = reqs[0].requiredAmount;
    } else {
      // Several items and no total: any one of them (the seed's "any boss pet" shape).
      cfg.trackedItemIds = reqs.map((r) => r.itemId);
      cfg.requiredAmount = 1;
    }
  }
  return cfg;
}

export async function suggestTasks(clanId: number, query: string): Promise<TaskSuggestion[]> {
  const { amount, rest } = splitAmount(query);
  const words = normalizeSearch(rest).split(' ').filter(Boolean);
  if (words.length === 0 || words.join('').length < 2) return [];

  const [library, items] = await Promise.all([listLibrary(clanId), getItemMapping().catch(() => [] as MappingItem[])]);
  const byName = new Map<string, MappingItem>();
  for (const it of items) if (!byName.has(it.name.toLowerCase())) byName.set(it.name.toLowerCase(), it);

  const out: TaskSuggestion[] = [];

  // A clan's library starts empty until someone imports the starter tasks, so the seed fills in for
  // whatever the clan hasn't taken — the box is useful on a brand-new clan's first board too.
  const taken = new Set(library.map((t) => t.seedKey).filter(Boolean));
  const pool = [
    ...library.map((t) => ({ id: `library-${t.id}`, label: t.label, category: t.category, points: t.points, config: t.config })),
    ...SEED_TASKS.filter((t) => !taken.has(t.key)).map((t) => ({ id: `seed-${t.key}`, label: t.label, category: t.category ?? null, points: t.points, config: t.config })),
  ];
  for (const t of pool) {
    if (out.length >= 5) break;
    if (!matchesAll(`${t.label} ${t.category ?? ''}`, words)) continue;
    const config = rowToTileConfig(t.config, byName);
    if (!config) continue;
    out.push({
      key: t.id,
      source: 'library',
      title: t.label,
      hint: `Ready-made task${t.category ? ` · ${t.category}` : ''}`,
      config: { ...config, label: t.label, points: t.points, category: t.category },
    });
  }

  for (const b of BOSSES) {
    if (out.filter((s) => s.source === 'boss').length >= 3) break;
    if (!matchesAll(`${b.label} ${(b.aliases ?? []).join(' ')}`, words)) continue;
    const goal = amount ?? 25;
    out.push({
      key: `boss-${b.key}`,
      source: 'boss',
      title: `${goal.toLocaleString('en-US')} ${b.label} kills`,
      hint: 'Kill count, read off the hiscores — works without the plugin',
      config: { tileType: 'standard', statType: 'boss', trackedStat: b.key, statGoal: goal, statBasis: 'gain', label: `${goal.toLocaleString('en-US')} ${b.label} kills` },
    });
  }

  for (const s of SKILLS) {
    if (s === 'overall' && !words.some((w) => ['total', 'overall', 'xp'].includes(w))) continue;
    const name = SKILL_LABELS[s] ?? s;
    if (!matchesAll(`${name} ${(SKILL_ALIASES[s] ?? []).join(' ')} xp`, words)) continue;
    if (out.filter((x) => x.source === 'skill').length >= 2) break;
    const goal = amount ?? 1_000_000;
    const label = `${shortNumber(goal)} ${s === 'overall' ? 'total' : name} XP`;
    out.push({
      key: `skill-${s}`,
      source: 'skill',
      title: label,
      hint: 'XP gained during the event, read off the hiscores',
      config: { tileType: 'standard', statType: 'skill', trackedStat: s, statGoal: goal, statBasis: 'gain', label },
    });
  }

  const want = words.join(' ');
  const itemHits = items
    .filter((it) => matchesAll(it.name, words) && isDroppableItem(it))
    .sort((a, b) => {
      const an = normalizeSearch(a.name);
      const bn = normalizeSearch(b.name);
      return (an === want ? 0 : an.startsWith(want) ? 1 : 2) - (bn === want ? 0 : bn.startsWith(want) ? 1 : 2) || an.length - bn.length;
    })
    .filter((it, i, arr) => arr.findIndex((o) => o.name === it.name) === i)
    .slice(0, 5);
  // A ready-made task for the same item already says it better ("Zenyte shard" twice was noise).
  const offered = new Set(out.map((o) => normalizeSearch(o.title)));
  for (const it of itemHits) {
    if (amount == null && offered.has(normalizeSearch(it.name))) continue;
    const n = amount ?? 1;
    const label = n > 1 ? `${n.toLocaleString('en-US')} × ${it.name}` : it.name;
    out.push({
      key: `item-${it.id}`,
      source: 'item',
      title: label,
      hint: 'Drop — the plugin spots it when it lands',
      config: { tileType: 'drop', trackedItemIds: [it.id], itemRequirements: null, requiredAmount: n, statType: null, trackedStat: null, statGoal: null, targetNpcs: null, label },
    });
  }

  // A typed amount ("100 zulrah") is honoured by the boss, skill and item suggestions, not by a
  // ready-made task with its own fixed number — so those go first when there is one.
  if (amount != null) {
    const rank: Record<TaskSuggestion['source'], number> = { boss: 0, skill: 0, item: 1, library: 2 };
    out.sort((a, b) => rank[a.source] - rank[b.source]);
  }
  return out.slice(0, 12);
}
