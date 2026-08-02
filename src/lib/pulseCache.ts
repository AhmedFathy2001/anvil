// Tiny in-process TTL memo for the board "pulse" tokens (see the /pulse routes). When many people
// watch the same board, their focus-polls land within a few seconds of each other — without this each
// poll runs the fingerprint aggregates again. Caching per (board) key for a short TTL collapses that
// burst to ONE DB computation; concurrent callers share the in-flight promise so a thundering herd at
// TTL expiry still only queries once.
//
// Deliberately per-process and best-effort: on a multi-instance deploy each instance keeps its own
// cache (still collapses within an instance), and a stale token just means the board is at most TTL
// seconds behind — fine for a semi-realtime poll. Failures are NOT cached (the key is evicted so the
// next poll retries).

const TTL_MS = 5000;
const MAX_KEYS = 1000;

const cache = new Map<string, { promise: Promise<string>; at: number }>();

export function cachedPulseToken(
  key: string,
  compute: () => Promise<string>,
  ttlMs: number = TTL_MS,
): Promise<string> {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && now - hit.at < ttlMs) {
    return hit.promise;
  }

  const promise = compute().catch((err) => {
    // Don't cache a failed computation — drop it so the next poll re-runs.
    if (cache.get(key)?.promise === promise) {
      cache.delete(key);
    }
    throw err;
  });
  cache.set(key, { promise, at: now });

  // Opportunistic sweep so dead board ids don't accumulate.
  if (cache.size > MAX_KEYS) {
    for (const [k, v] of cache) {
      if (now - v.at > ttlMs * 4) cache.delete(k);
    }
  }

  return promise;
}
