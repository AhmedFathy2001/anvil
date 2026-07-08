import { BOSSES } from '@/lib/constants';

// Real-time boss KC pushed by the plugin lives in `players.plugin_stats` as a flat JSON map of
// hiscores boss key -> absolute count ({"zulrah":1250}). It's kept separate from `cachedStats`
// (the hiscores snapshot) so the hourly cron never clobbers it; every read takes the per-key max
// of the two, and the cron prunes a plugin entry once hiscores catches up. See /api/plugin/stats.

// Normalize a boss name for matching: lowercase, non-alphanumeric -> space, collapse. Makes
// "Tombs of Amascut: Expert Mode", "TzKal-Zuk", and "Kree'Arra" line up with their keys/aliases
// regardless of the punctuation the KC chat line uses.
export function normalizeBossName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

// hiscores boss key -> the in-game KC-line names the plugin should watch (label + aliases),
// lowercased. Sent to the plugin as `trackedKcNames`; the plugin normalizes both sides before
// matching, so aliases like "chambers of xeric challenge mode" cover the mode-variant raids.
export function kcNamesForKey(key: string): string[] {
  const b = BOSSES.find((x) => x.key === key);
  if (!b) return [];
  return [b.label, ...(b.aliases ?? [])].map((n) => n.toLowerCase());
}

// Reverse lookup: an in-game boss name (as the plugin saw it in chat) -> hiscores key, or null.
// Labels are indexed first so a real boss name always wins over a generic shared alias
// ("raids", "gwd", "dks") — which the plugin never pushes anyway (KC lines carry full names).
const REVERSE: Map<string, string> = (() => {
  const m = new Map<string, string>();
  for (const b of BOSSES) m.set(normalizeBossName(b.label), b.key);
  for (const b of BOSSES) {
    for (const a of b.aliases ?? []) {
      const n = normalizeBossName(a);
      if (!m.has(n)) m.set(n, b.key);
    }
  }
  return m;
})();

export function bossKeyForName(name: string): string | null {
  return REVERSE.get(normalizeBossName(name)) ?? null;
}

// Parse the flat plugin_stats JSON ({key: kc}). Returns {} on null/garbage; drops non-numeric
// and negative values.
export function parsePluginStats(json: string | null | undefined): Record<string, number> {
  if (!json) return {};
  try {
    const parsed = JSON.parse(json);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const out: Record<string, number> = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === 'number' && Number.isFinite(v) && v >= 0) out[k] = v;
      }
      return out;
    }
  } catch {
    /* ignore malformed */
  }
  return {};
}

// Effective current value for one boss key = max(hiscores score, plugin-pushed count). Hiscores
// -1 (unranked) floors to 0. Skills never appear in plugin_stats, so this is a no-op for them.
export function effectiveKc(hiscoresScore: number, pluginMap: Record<string, number>, key: string): number {
  const h = hiscoresScore < 0 ? 0 : hiscoresScore;
  return Math.max(h, pluginMap[key] ?? 0);
}
