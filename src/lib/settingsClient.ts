// Shared client-side loader for GET /api/admin/settings.
//
// The Integrations page mounts ~10 settings widgets, each of which used to fetch the (identical,
// all-keys) settings payload on mount — so one page load fired ~10 duplicate requests. This
// coalesces them: concurrent callers share a single in-flight request, and the result is cached
// briefly so the whole page's mounts hit the network once. Any save invalidates the cache.

type Settings = Record<string, string>;

let cache: { data: Settings; at: number } | null = null;
let inflight: Promise<Settings> | null = null;
const TTL_MS = 5000;

/**
 * Load all admin settings, deduped. Concurrent calls (a page full of widgets mounting together)
 * resolve from one shared request; a fresh cache within TTL_MS is returned without a network call.
 * Pass `force` to bypass the cache. Returns `{}` if the request fails.
 */
export async function loadSettings(force = false): Promise<Settings> {
  if (!force) {
    if (cache && Date.now() - cache.at < TTL_MS) return cache.data;
    if (inflight) return inflight;
  }
  inflight = (async () => {
    try {
      const res = await fetch('/api/admin/settings');
      const data: Settings = res.ok ? await res.json() : {};
      cache = { data, at: Date.now() };
      return data;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** Drop the cache so the next load re-fetches — call after saving a setting. */
export function invalidateSettings(): void {
  cache = null;
}
