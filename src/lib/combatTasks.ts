import caData from '@/data/combatAchievements.json';
import caVarps from '@/data/combatAchievementVarps.json';
import type { ProgressItem } from '@/lib/memberProgressItems';

// The combat-achievement task list as the site draws it: every task the game has, joined with the
// ones this member has completed.
//
// The plugin sends only what's DONE — a few hundred names — and the catalogue of what exists comes
// from the wiki dataset we already ship for the tile picker (src/data/combatAchievements.json). So
// the wire stays small and the "which am I missing" half, which is the whole point of the screen,
// is answered from data that's already here.

export interface CombatTask {
  name: string;
  tier: string;
  type: string | null;
  monster: string | null;
  description: string | null;
  done: boolean;
}

interface RawTask {
  id: number;
  name: string;
  tier: string;
  type?: string | null;
  monster?: string | null;
  description?: string | null;
}

const RAW = (caData as { tasks?: RawTask[] }).tasks ?? [];
export const CA_TIERS: string[] = (caData as { tiers?: string[] }).tiers ?? [];

/** Points a tier is worth, matching the game's own scoring. */
export const TIER_POINTS: Record<string, number> = {
  Easy: 1, Medium: 2, Hard: 3, Elite: 4, Master: 5, Grandmaster: 6,
};

/** Names arrive from the game via the plugin and from the wiki via the dataset; normalise both. */
function norm(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * The full task list, marked with what this member has done.
 *
 * Matching is by NAME, not id: the plugin reads the game's own struct list, the dataset is the
 * wiki's transcription of it, and the one field both are certain to agree on is what the task is
 * called.
 */
export function combatTasks(completed: ProgressItem[] | null | undefined): CombatTask[] {
  const done = new Set((completed ?? []).filter((i) => i.state === 2).map((i) => norm(i.name)));
  return RAW.map((task) => ({
    name: task.name,
    tier: task.tier,
    type: task.type ?? null,
    monster: task.monster ?? null,
    description: task.description ?? null,
    done: done.has(norm(task.name)),
  }));
}

/** Every monster with at least one task, alphabetically — the "Monster" filter's options. */
export function taskMonsters(tasks: CombatTask[]): string[] {
  const set = new Set<string>();
  for (const t of tasks) {
    if (t.monster) set.add(t.monster);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

/** Every task type ("Kill Count", "Perfection", …) — the "Type" filter's options. */
export function taskTypes(tasks: CombatTask[]): string[] {
  const set = new Set<string>();
  for (const t of tasks) {
    if (t.type) set.add(t.type);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

export interface TaskFilters {
  search?: string;
  tier?: string | null;
  type?: string | null;
  monster?: string | null;
  completed?: 'all' | 'done' | 'todo';
}

/** The list the screen shows, in the game's own order: by tier, then by name. */
export function filterTasks(tasks: CombatTask[], f: TaskFilters = {}): CombatTask[] {
  const needle = (f.search ?? '').trim().toLowerCase();
  return tasks
    .filter((t) => {
      if (f.tier && t.tier !== f.tier) return false;
      if (f.type && t.type !== f.type) return false;
      if (f.monster && t.monster !== f.monster) return false;
      if (f.completed === 'done' && !t.done) return false;
      if (f.completed === 'todo' && t.done) return false;
      if (needle) {
        const haystack = `${t.name} ${t.monster ?? ''} ${t.description ?? ''}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const tierDiff = (TIER_POINTS[a.tier] ?? 0) - (TIER_POINTS[b.tier] ?? 0);
      return tierDiff !== 0 ? tierDiff : a.name.localeCompare(b.name);
    });
}

/**
 * Points earned and what the next tier costs, for the bar across the top of the screen.
 *
 * Thresholds are derived from the catalogue rather than stored: a tier unlocks at the point total of
 * every task up to and including it, which is what the game itself is counting.
 */
export function taskPoints(tasks: CombatTask[]): {
  earned: number;
  total: number;
  nextTier: string | null;
  nextAt: number | null;
} {
  let earned = 0;
  let total = 0;
  const perTier = new Map<string, number>();
  for (const t of tasks) {
    const worth = TIER_POINTS[t.tier] ?? 0;
    total += worth;
    if (t.done) earned += worth;
    perTier.set(t.tier, (perTier.get(t.tier) ?? 0) + worth);
  }
  // A tier's unlock threshold is every point up to the end of it.
  let running = 0;
  for (const tier of CA_TIERS) {
    running += perTier.get(tier) ?? 0;
    if (earned < running) {
      return { earned, total, nextTier: tier, nextAt: running };
    }
  }
  return { earned, total, nextTier: null, nextAt: null };
}

// ── Reading completion out of the game's own bits ───────────────────────────────────────────────
//
// The game stores task completion bit-packed across a handful of player varps: task `i` is bit
// `i % 32` of varp number `i / 32` in the published order. So the plugin doesn't need to know
// anything about tasks at all — it reads twenty-one integers and sends them, and the meaning is
// applied here, where the catalogue already lives. A game update that adds a varp is then a data
// change in this repo rather than a plugin release.

const VARP_ORDER: number[] = (caVarps as { varps?: number[] }).varps ?? [];
const BITS_PER_VARP: number = (caVarps as { bitsPerVarp?: number }).bitsPerVarp ?? 32;

/** The varp ids the plugin should read, in the order the bits are laid out. */
export function combatTaskVarps(): number[] {
  return VARP_ORDER;
}

/** Task ids the bits say are complete. Unknown varps are ignored rather than shifting the order. */
export function decodeCompletedTaskIds(varps: Record<string, number> | null | undefined): Set<number> {
  const done = new Set<number>();
  if (!varps) return done;
  VARP_ORDER.forEach((varpId, index) => {
    const raw = varps[String(varpId)];
    if (typeof raw !== 'number' || !Number.isFinite(raw)) return;
    // Varps are signed 32-bit; >>> makes the top bit readable as a bit rather than a sign.
    const value = raw >>> 0;
    for (let bit = 0; bit < BITS_PER_VARP; bit++) {
      if (value & (1 << bit)) done.add(index * BITS_PER_VARP + bit);
    }
  });
  return done;
}

/**
 * Turn decoded ids into the stored item list — but only if they reconcile.
 *
 * The points a decode implies are compared against the game's own total, which the plugin reads
 * from a varbit and sends alongside. Hundreds of tasks summing to exactly the right number is not
 * something a misaligned decode achieves by accident, so a mismatch means the bit layout moved and
 * we store nothing rather than marking tasks wrong. Null = "we don't know", never "none done".
 */
export function completedTasksFromVarps(
  varps: Record<string, number> | null | undefined,
  caPoints: number | null | undefined,
): ProgressItem[] | null {
  if (!varps || !caPoints || caPoints <= 0) return null;
  const ids = decodeCompletedTaskIds(varps);
  if (ids.size === 0) return null;

  let points = 0;
  const items: ProgressItem[] = [];
  for (const task of RAW) {
    if (!ids.has(task.id)) continue;
    points += TIER_POINTS[task.tier] ?? 0;
    items.push({ id: task.id, name: task.name, state: 2, group: task.monster ?? null });
  }
  return points === caPoints ? items : null;
}
