/**
 * FACT IDS — the pure half (lib/pluginFacts/factIdStore is the database half).
 *
 * A plugin fact may carry `id`: an opaque token the plugin makes once when the fact is created and
 * sends again unchanged, so a fact whose first send may or may not have landed can be sent again
 * without being credited twice. A fact with no id (an older plugin) behaves exactly as before.
 *
 * What is remembered, per signed-in person and in-game account, for at least two days:
 *   - `fact:<user>:<id>:<tile>`  this fact's credit on that tile is in (written in the same
 *                                transaction as the submission row, so it is in exactly when the credit is)
 *   - `fact:<user>:<id>`         the whole fact was answered for good (written once nothing of it is
 *                                being sent back under `retry`)
 * Nothing else is stored: no item, no amount, no name.
 */
import type { Fact } from '@/lib/pluginFacts/match';

const FACT_ID = /^[A-Za-z0-9_-]{8,40}$/;

/** A fact id as a client may send it, or null: malformed is treated as absent, never refused. */
export function parseFactId(raw: unknown): string | null {
  return typeof raw === 'string' && FACT_ID.test(raw) ? raw : null;
}

/** The ids a submission may name (the facts one credit was made of), shape-checked and bounded. */
export function parseFactIds(raw: unknown, max = 50): string[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.map(parseFactId).filter((id): id is string => id != null))].slice(0, max);
}

/** "This whole fact was answered for good." */
export function factKey(userId: number, id: string): string {
  return `fact:${userId}:${id}`;
}

/** "This fact's credit on this tile is in." The tile id is the one the credit names (a cap counter's is its own). */
export function factTileKey(userId: number, id: string, tileId: number): string {
  return `${factKey(userId, id)}:${tileId}`;
}

/** The fact id inside either key, or null for a key that is not one of this person's fact keys. */
export function factIdOfKey(userId: number, key: string): string | null {
  const prefix = `fact:${userId}:`;
  if (!key.startsWith(prefix)) return null;
  return parseFactId(key.slice(prefix.length).split(':')[0]);
}

/**
 * Before anything is matched: the facts already answered for good are set aside (never matched,
 * never filed, never sent back), and so is a second fact with an id this same batch already holds.
 * `settled` = the ids whose whole-fact key is stored.
 */
export function splitDuplicates(facts: Fact[], settled: ReadonlySet<string>): { fresh: Fact[]; duplicateIds: string[] } {
  const fresh: Fact[] = [];
  const duplicateIds: string[] = [];
  const inBatch = new Set<string>();
  for (const f of facts) {
    if (f.id && (settled.has(f.id) || inBatch.has(f.id))) {
      duplicateIds.push(f.id);
      continue;
    }
    if (f.id) inBatch.add(f.id);
    fresh.push(f);
  }
  return { fresh, duplicateIds };
}

/** How the submissions route answered one filing that named fact ids. */
export type FactClaim = 'fresh' | 'duplicate' | 'mixed';

/**
 * A filing names the facts it is made of. None seen on this tile: file it. All seen: it is in
 * already, answer as accepted and file nothing. Some seen (several kills folded into one credit,
 * one of them in from an earlier request): file nothing and send it back, each seen fact marked
 * done for this tile, so the next send files only what is new.
 */
export function decideFactClaim(named: number, seen: number): FactClaim {
  if (named === 0 || seen === 0) return 'fresh';
  return seen >= named ? 'duplicate' : 'mixed';
}

/** The ids to store as answered for good: every id'd fact that is not being sent back. */
export function settledIds(facts: Fact[], retry: Fact[]): string[] {
  const back = new Set(retry.map((f) => f.id).filter(Boolean));
  return [...new Set(facts.map((f) => f.id).filter((id): id is string => !!id && !back.has(id)))];
}
