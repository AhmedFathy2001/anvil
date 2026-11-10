// "What should players do?" — turn what an admin types into tiles that are already set up to track.
//
// The tile editor used to open on a grid of fifteen tile kinds, before the admin had said what the
// task was. People think "Zenyte shard" or "100 Zulrah", not "drop pool" or "boss KC stat tile", so
// a first board was mostly Standard tiles — the kind that never tracks — with real names on them.
// This answers the question the other way round: type the task, pick a suggestion, and the kind and
// its fields arrive filled in.
//
// The matching itself is pure (lib/taskMatch) and covers every kind; this module only gathers what it
// searches: the clan's own task library and the starter tasks (already fully configured), the item
// catalogue, the collection-log pages, and which items a monster drops.

import { getItemMapping, isDroppableItem, itemsByName, type MappingItem } from '@/lib/osrsItems';
import { listLibrary } from '@/lib/tileLibrary';
import { listAnvilTasks } from '@/lib/libraryTasks';
import { rowToTileConfig, splitAmount } from '@/lib/taskSuggestRows';
import { clogPages, isMonsterDrop } from '@/lib/itemObtain';
import { getMonsterNames } from '@/lib/npcNames';
import {
  classifyMatches,
  libraryCandidate,
  matchTasks,
  parseBulkLine,
  parseTaskQuery,
  screenshotCandidate,
  type LineStatus,
  type MatchContext,
  type TaskCandidate,
} from '@/lib/taskMatch';

export { rowToTileConfig, splitAmount };

/** One suggestion: a tile that is already set up to track (see lib/taskMatch TaskCandidate). */
export type TaskSuggestion = TaskCandidate;

// One entry per name, preferring the id something actually drops (the mapping lists bank
// placeholders and renamed variants under the same name). Cached per mapping so the matcher's
// word list (keyed on this array) is built once, not per request.
const dedupeCache = new WeakMap<MappingItem[], MappingItem[]>();
function dedupedItems(mapping: MappingItem[]): MappingItem[] {
  const hit = dedupeCache.get(mapping);
  if (hit) return hit;
  const items: MappingItem[] = [];
  const seen = new Map<string, number>();
  for (const it of mapping) {
    const k = it.name.toLowerCase();
    const at = seen.get(k);
    if (at == null) {
      seen.set(k, items.length);
      items.push(it);
    } else if (!isDroppableItem(items[at]) && isDroppableItem(it)) {
      items[at] = it;
    }
  }
  dedupeCache.set(mapping, items);
  return items;
}

/** Everything the matcher searches, for one clan. */
async function contextFor(clanId: number): Promise<MatchContext> {
  const [library, anvil, mapping, monsters] = await Promise.all([
    listLibrary(clanId),
    listAnvilTasks(),
    getItemMapping().catch(() => [] as MappingItem[]),
    getMonsterNames().catch(() => [] as string[]),
  ]);
  const byName = itemsByName(mapping);

  // The clan's own library first, then every Anvil task they haven't imported — so the box is useful
  // on a brand-new clan's first board too.
  const taken = new Set(library.map((t) => t.seedKey).filter(Boolean));
  const rows = [
    ...library.map((t) => ({ key: `library-${t.id}`, label: t.label, category: t.category ?? null, points: t.points ?? null, config: t.config })),
    ...anvil
      .filter((t) => !taken.has(t.key) && !library.some((l) => l.sourceTaskId === t.id))
      .map((t) => ({ key: `anvil-${t.id}`, label: t.label, category: t.category ?? null, points: t.points ?? null, config: t.config })),
  ];
  const resolved: NonNullable<MatchContext['library']> = [];
  for (const r of rows) {
    const config = rowToTileConfig(r.config, byName);
    if (config) resolved.push({ key: r.key, label: r.label, category: r.category, points: r.points, config });
  }

  return { items: dedupedItems(mapping), library: resolved, clogPages: clogPages(), itemIsMonsterDrop: isMonsterDrop, monsters };
}

export async function suggestTasks(clanId: number, query: string): Promise<TaskSuggestion[]> {
  const q = parseTaskQuery(query);
  if (q.text.replace(/[^a-z0-9]/gi, '').length < 2) return [];
  return matchTasks(query, await contextFor(clanId));
}

export interface BulkLineResult {
  line: string;
  text: string;
  points: number | null;
  status: LineStatus;
  /** The tile this line becomes when it's ready, or the options when it isn't. */
  choices: TaskSuggestion[];
  /** What a "screenshot" line becomes — always available as the last resort. */
  fallback: TaskSuggestion;
}

/** "Quick add: paste your list" — every line through the same matcher, with a verdict per line. */
export async function suggestBulk(clanId: number, lines: string[]): Promise<BulkLineResult[]> {
  const ctx = await contextFor(clanId);
  return lines.map((line) => {
    const { text, points } = parseBulkLine(line);
    const verdict = classifyMatches(matchTasks(text, ctx));
    return { line, text, points, status: verdict.status, choices: verdict.choices, fallback: screenshotCandidate(text) };
  });
}

/** A few tasks off the clan's past boards (its library), for the creator's start screen. */
export async function starterTasks(clanId: number, limit = 6): Promise<TaskSuggestion[]> {
  const ctx = await contextFor(clanId);
  const own = (ctx.library ?? []).filter((t) => t.key.startsWith('library-'));
  const pool = own.length > 0 ? own : ctx.library ?? [];
  return pool.slice(0, 40)
    // Spread across kinds rather than six drop tiles in a row.
    .sort((a, b) => (a.config.tileType ?? '').localeCompare(b.config.tileType ?? ''))
    .filter((t, i, arr) => arr.findIndex((o) => o.config.tileType === t.config.tileType) === i || i % 3 === 0)
    .slice(0, limit)
    .map(libraryCandidate);
}
