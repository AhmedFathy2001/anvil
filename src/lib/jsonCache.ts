/**
 * A tiny in-memory read cache for the few GETs a tile dialog needs (proof, readiness, race picks).
 *
 * Three jobs: (1) a read that is already in flight is shared, not repeated; (2) a finished read is
 * kept so the next open of the same tile paints at once while a fresh read runs behind it
 * (stale-while-revalidate: the caller shows `peek()` first, then the new value); (3) `prefetch` lets
 * hover/focus intent warm a read before the click. The cache lives for the page session only.
 * Nothing here is shared between people, and a failed read is never stored.
 */

export type JsonFetcher = (url: string) => Promise<{ ok: boolean; json: () => Promise<unknown> }>;

export function createJsonCache(fetcher: JsonFetcher, now: () => number = Date.now, freshMs = 5_000) {
  const store = new Map<string, { data: unknown; at: number }>();
  const inflight = new Map<string, Promise<unknown | undefined>>();

  function load<T>(url: string, opts: { force?: boolean } = {}): Promise<T | undefined> {
    const hit = store.get(url);
    if (hit && !opts.force && now() - hit.at < freshMs) return Promise.resolve(hit.data as T);
    const running = inflight.get(url);
    if (running) return running as Promise<T | undefined>;
    const p = (async () => {
      try {
        const res = await fetcher(url);
        if (!res.ok) return hit?.data;
        const data = await res.json();
        store.set(url, { data, at: now() });
        return data;
      } catch {
        return hit?.data;
      } finally {
        inflight.delete(url);
      }
    })();
    inflight.set(url, p);
    return p as Promise<T | undefined>;
  }

  return {
    /** The last good value for `url`, however old. */
    peek<T>(url: string): T | undefined {
      return store.get(url)?.data as T | undefined;
    },
    load,
    /** Fire and forget: warm `url` unless it is fresh or already on its way. */
    prefetch(url: string): void {
      void load(url);
    },
    /** Forget one entry (after a write that changes it). */
    drop(url: string): void {
      store.delete(url);
    },
    clear(): void {
      store.clear();
    },
  };
}
