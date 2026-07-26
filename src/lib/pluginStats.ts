import { BOSSES, SKILLS } from '@/lib/constants';

// Skill-XP pushes key on the plain lowercase skill name ("mining"), which is exactly how skill XP is
// stored in the hiscores snapshot (cachedStats.skills["mining"].xp) and how a skill tile's trackedStat
// reads — so no separate mapping is needed beyond validating it's a real skill.
const SKILL_KEYS: ReadonlySet<string> = new Set(SKILLS as readonly string[]);

/** A pushed skill name → its hiscores/pluginStats key (lowercase), or null if it isn't a real skill. */
export function skillKeyForName(name: string): string | null {
  const k = name.trim().toLowerCase();
  return SKILL_KEYS.has(k) && k !== 'overall' ? k : null;
}

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

// The KC chat line drops the leading "The" from boss names ("Your Leviathan kill count is: 1"
// for The Leviathan), so both name forms must match. Empty when the name carries no article.
function strippedArticleForm(name: string): string | null {
  const stripped = name.replace(/^the\s+/i, '');
  return stripped !== name ? stripped : null;
}

// hiscores boss key -> the in-game KC-line names the plugin should watch (label + aliases, plus
// leading-"The"-stripped forms), lowercased. Sent to the plugin as `trackedKcNames`; the plugin
// normalizes both sides before matching, so aliases like "chambers of xeric challenge mode" cover
// the mode-variant raids.
export function kcNamesForKey(key: string): string[] {
  const b = BOSSES.find((x) => x.key === key);
  if (!b) return [];
  const names = [b.label, ...(b.aliases ?? [])];
  return [...names, ...names.map(strippedArticleForm).filter((n): n is string => n !== null)].map(
    (n) => n.toLowerCase(),
  );
}

// Reverse lookup: an in-game boss name (as the plugin saw it in chat) -> hiscores key, or null.
// Labels are indexed first so a real boss name always wins over a generic shared alias
// ("raids", "gwd", "dks") — which the plugin never pushes anyway (KC lines carry full names).
// Article-stripped forms are indexed last so they can never displace an exact name.
const REVERSE: Map<string, string> = (() => {
  const m = new Map<string, string>();
  const add = (name: string, key: string) => {
    const n = normalizeBossName(name);
    if (!m.has(n)) m.set(n, key);
  };
  for (const b of BOSSES) add(b.label, b.key);
  for (const b of BOSSES) for (const a of b.aliases ?? []) add(a, b.key);
  for (const b of BOSSES) {
    for (const name of [b.label, ...(b.aliases ?? [])]) {
      const stripped = strippedArticleForm(name);
      if (stripped) add(stripped, b.key);
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
