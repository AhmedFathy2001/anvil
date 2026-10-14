// Short-lived in-process memo for hot read paths that many clients ask the same question of — the
// generic sibling of lib/pulseCache. During a live event every plugin client and every open board tab
// polls; within a few seconds they all want the same per-event / per-team answer, so one computation
// serves them all. Concurrent callers share the in-flight promise; failures are never cached.
//
// Per-process and best-effort: a value can be up to ttlMs stale, which is fine for anything that is
// already a poll. Never put per-viewer or permission-dependent data behind a key that omits the viewer.

const MAX_KEYS = 2000;

const cache = new Map<string, { promise: Promise<unknown>; at: number; ttlMs: number }>();

export function ttlMemo<T>(key: string, compute: () => Promise<T>, ttlMs: number): Promise<T> {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && now - hit.at < hit.ttlMs) {
    return hit.promise as Promise<T>;
  }

  const promise = compute().catch((err) => {
    if (cache.get(key)?.promise === promise) cache.delete(key);
    throw err;
  });
  cache.set(key, { promise, at: now, ttlMs });

  if (cache.size > MAX_KEYS) {
    for (const [k, v] of cache) {
      if (now - v.at >= v.ttlMs) cache.delete(k);
    }
  }

  return promise;
}
