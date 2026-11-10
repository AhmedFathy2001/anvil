// A collection-log unlock reported the moment it happens, rather than discovered at the next sync.
//
// The log only reaches us when the player syncs it, and whatever arrives new then is stamped with the
// sync's date and the page's CURRENT kill counter: Moxi taken on the 16th Amoxliatl and synced at 39
// read "at 39 KC", and an item nobody synced for a week read as today's. The in-game line ("New item
// added to your collection log: Moxi") is the one moment both numbers are known, so the plugin sends
// it straight away and the row exists before any sync — which then keeps its date and KC.
//
// The line names the item, not its id, so the catalogue resolves it. The kill line the plugin pairs
// with it is only trusted when it belongs to the item's page: a raid unique doesn't get stamped with
// the Vorkath kill from ten seconds earlier.
//
// Pure (catalogue + constants only), so it is tested directly (tests/clog-unlock.test.ts).

import { BOSSES } from '@/lib/constants';
import { clogItemNames, clogPageOfItem } from '@/lib/clogDataset';

let idsByNameCache: Map<string, number[]> | null = null;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Every catalogue id carrying this display name — a few names exist twice (variants). */
export function clogIdsForName(name: string): number[] {
  if (!idsByNameCache) {
    const map = new Map<string, number[]>();
    for (const [id, itemName] of clogItemNames()) {
      const key = norm(itemName);
      const list = map.get(key) ?? [];
      list.push(id);
      map.set(key, list);
    }
    idsByNameCache = map;
  }
  return idsByNameCache.get(norm(name)) ?? [];
}

function bossKeyOf(label: string): string | null {
  const n = norm(label);
  return BOSSES.find((b) => norm(b.label) === n)?.key ?? null;
}

/**
 * Whether a kill line ("Your Amoxliatl kill count is: 16" → "Amoxliatl") counts kills for a log page.
 * Same name, or the same hiscores boss under two spellings.
 */
export function killLineBelongsToPage(kcName: string, page: string): boolean {
  if (norm(kcName) === norm(page)) return true;
  const a = bossKeyOf(kcName);
  return a != null && a === bossKeyOf(page);
}

export interface ResolvedUnlock {
  itemId: number;
  page: string;
  /** The plugin's kill count, when its kill line belongs to the item's page; else null. */
  kc: number | null;
}

/**
 * The catalogue slot an unlock line names, and the KC to stamp it with.
 *
 * Null when the name isn't in the catalogue. With several ids for one name, the first one the account
 * doesn't already hold — the line fires only for a slot that was empty.
 */
export function resolveUnlock(
  input: { name: string; kcName?: string | null; kc?: number | null },
  owned: Set<number>,
): ResolvedUnlock | null {
  const ids = clogIdsForName(input.name);
  const pageOf = clogPageOfItem();
  const candidates = ids.filter((id) => pageOf.has(id));
  if (candidates.length === 0) return null;
  const itemId = candidates.find((id) => !owned.has(id)) ?? candidates[0];
  const page = pageOf.get(itemId)!;
  const kc =
    input.kcName && input.kc != null && Number.isFinite(input.kc) && input.kc > 0 && killLineBelongsToPage(input.kcName, page)
      ? Math.floor(input.kc)
      : null;
  return { itemId, page, kc };
}

export interface UnlockStampRow {
  itemId: number;
  firstSeenAt: string | null;
  kcAtUnlock: number | null;
}

/**
 * A sync replaced a guessed row: keep the unlock's date and KC on the slot it really was.
 *
 * resolveUnlock files a live unlock under the first same-named slot the account didn't hold, so a
 * "Decorative armour" line can land on the red platebody when it was the gold one. The next sync
 * drops the row it doesn't list and adds the one it does; without this the true slot would be dated
 * to the sync and lose the KC the line was stamped with. Each dropped, dated row hands its stamp to
 * the first added row sharing its name that hasn't had one. Mutates and returns `added`.
 */
export function carryGuessedStamps<T extends UnlockStampRow>(gone: UnlockStampRow[], added: T[]): T[] {
  const names = clogItemNames();
  const taken = new Set<number>();
  for (const old of gone) {
    if (!old.firstSeenAt) continue;
    const name = names.get(old.itemId);
    if (!name || clogIdsForName(name).length < 2) continue;
    const key = norm(name);
    const heir = added.find((r) => !taken.has(r.itemId) && r.itemId !== old.itemId && norm(names.get(r.itemId) ?? '') === key);
    if (!heir) continue;
    taken.add(heir.itemId);
    heir.firstSeenAt = old.firstSeenAt;
    heir.kcAtUnlock = old.kcAtUnlock ?? heir.kcAtUnlock;
  }
  return added;
}
