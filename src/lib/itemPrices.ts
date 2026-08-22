// Grand Exchange prices, for saying what a collection log is worth.
//
// Rarity answers "how unlikely was that"; value answers "what is it". They rank very differently —
// a 1-in-13,107 mutagen and a twisted bow are not close in either direction — and a clan argues
// about both, so the profile offers both.
//
// From the wiki's own price API, the same family as the item mapping we already read. Cached for
// hours because the numbers barely move on the scale a profile cares about, and NEVER fatal: a
// price fetch that fails simply means the value view has nothing to show, while everything else on
// the page carries on.

const LATEST_URL = 'https://prices.runescape.wiki/api/v1/osrs/latest';
const USER_AGENT = 'anvil-clan-site (collection log value)';

/** Prices move slowly next to how often a profile is opened; an hour of staleness is invisible. */
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

/** Don't retry a failing API on every page render — a clan site shouldn't hammer the wiki. */
const FAILURE_BACKOFF_MS = 10 * 60 * 1000;

let cache: Map<number, number> | null = null;
let cachedAt = 0;
let failedAt = 0;
let inFlight: Promise<Map<number, number>> | null = null;

interface LatestEntry {
  high?: number | null;
  low?: number | null;
}

/**
 * Item id → gp, as a mid of the latest buy and sell.
 *
 * The mid rather than either side: an instant-buy price flatters a log and an instant-sell one
 * undersells it, and the number people quote to each other sits between them. Untradeable items —
 * pets, most raid uniques' cosmetics, quest rewards — never appear in the feed and so have no value
 * here, which is the honest answer rather than a zero.
 */
export async function getItemPrices(): Promise<Map<number, number>> {
  const now = Date.now();
  if (cache && now - cachedAt < CACHE_TTL_MS) return cache;
  if (now - failedAt < FAILURE_BACKOFF_MS) return cache ?? new Map();
  // Several profile renders at once should make one request, not one each.
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const res = await fetch(LATEST_URL, { headers: { 'User-Agent': USER_AGENT } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { data?: Record<string, LatestEntry> };
      const prices = new Map<number, number>();
      for (const [idStr, entry] of Object.entries(body.data ?? {})) {
        const id = parseInt(idStr, 10);
        if (!Number.isInteger(id)) continue;
        const high = typeof entry.high === 'number' ? entry.high : null;
        const low = typeof entry.low === 'number' ? entry.low : null;
        const mid = high != null && low != null ? Math.round((high + low) / 2) : (high ?? low);
        if (mid != null && mid > 0) prices.set(id, mid);
      }
      cache = prices;
      cachedAt = Date.now();
      failedAt = 0;
      return prices;
    } catch {
      // Keep whatever we had; a profile with slightly stale prices beats one that fails to render.
      failedAt = Date.now();
      return cache ?? new Map<number, number>();
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

/** "1.4b" / "23.5m" / "812k" — the way a price is said out loud, not 1,412,983,004. */
export function formatGp(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0';
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(value >= 10_000_000_000 ? 0 : 1)}b`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}m`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`;
  return String(Math.round(value));
}
