import caData from '@/data/combatAchievements.json';
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
