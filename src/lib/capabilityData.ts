import { BOSSES } from '@/lib/constants';
import requirementsJson from '@/data/activityRequirements.json';
import markersJson from '@/data/capabilityMarkers.json';
import ratesJson from '@/data/balanceRates.json';
import caJson from '@/data/combatAchievements.json';
import type { ActivitySpec, CaTier } from '@/lib/capability';

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// Builds the ability table's activity specs from the curated files:
//   activityRequirements.json  — stat floors, pure-friendliness, iron gear, related content
//   capabilityMarkers.json     — fullKc where a marker exists
//   balanceRates.json          — kill/attempt time → fullKc and "recent kills" for everything else
//   combatAchievements.json    — the fastest speed target per boss
// PURE (static JSON only) — safe for tests and for the client.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

interface RequirementRow {
  hard?: Record<string, number>;
  realistic?: Record<string, number>;
  pureFriendly?: boolean;
  ironGear?: string[][];
  related?: string[];
}
interface RateRow {
  killSeconds?: number[];
  attemptMinutes?: number[];
}

const REQUIREMENTS = (requirementsJson as { activities: Record<string, RequirementRow> }).activities;
const MARKER_FULL_KC = new Map(
  (markersJson as { markers: { key: string; fullKc: number }[] }).markers.map((m) => [m.key, m.fullKc]),
);
const RATES = (ratesJson as unknown as { activities: Record<string, RateRow> }).activities;

/** Same normalisation the balance model uses for activity names. */
export function normActivityName(s: string): string {
  return s
    .toLowerCase()
    .replace(/^the\s+/, '')
    .replace(/:/g, '')
    .replace(/[^a-z0-9' -]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const RATE_BY_NORM = new Map(Object.entries(RATES).map(([k, v]) => [normActivityName(k), v]));

/** Names the game, the wiki and the hiscores use for one boss, where they don't share a label. */
const EXTRA_NAMES: Record<string, string[]> = {
  tzKalZuk: ['inferno', 'tzkal-zuk'],
  tzTokJad: ['fight caves', 'tztok-jad', 'tzhaar fight cave'],
  solHeredit: ['fortis colosseum', 'sol heredit', 'colosseum'],
  corruptedGauntlet: ['corrupted hunllef', 'corrupted gauntlet'],
  gauntlet: ['crystalline hunllef', 'gauntlet'],
  chambersOfXericChallengeMode: ['chambers of xeric challenge mode'],
  theatreOfBloodHardMode: ['theatre of blood hard mode'],
  tombsOfAmascutExpertMode: ['tombs of amascut expert mode'],
  leviathan: ['leviathan'],
  whisperer: ['whisperer'],
  hueycoatl: ['hueycoatl'],
  nightmare: ['nightmare'],
  phosanisNightmare: ["phosani's nightmare"],
  lunarChests: ['moons of peril', 'lunar chest'],
  royalTitans: ['royal titans'],
  mimic: ['mimic'],
};

/** Every normalised name that means this boss key. */
export function namesForBoss(key: string): string[] {
  const b = BOSSES.find((x) => x.key === key);
  const names = [b?.label, ...(b?.aliases ?? []), ...(EXTRA_NAMES[key] ?? [])].filter((x): x is string => !!x);
  return [...new Set(names.map(normActivityName))];
}

const BOSS_BY_NAME = (() => {
  const m = new Map<string, string>();
  for (const b of BOSSES) for (const n of namesForBoss(b.key)) if (!m.has(n)) m.set(n, b.key);
  return m;
})();

/** A game / wiki / PB activity name → BOSSES key, or null. */
export function bossKeyForName(name: string | null | undefined): string | null {
  if (!name) return null;
  return BOSS_BY_NAME.get(normActivityName(name)) ?? null;
}

/** Average minutes one kill / attempt takes, from the balance rates. */
function killMinutes(key: string): number | null {
  for (const n of namesForBoss(key)) {
    const r = RATE_BY_NORM.get(n);
    if (!r) continue;
    if (r.killSeconds?.length === 3) return r.killSeconds[1] / 60;
    if (r.attemptMinutes?.length === 3) return r.attemptMinutes[1];
  }
  return null;
}

/** "1 minute and 15 seconds", "65 minutes", "54 seconds", "28:00 or less", "1:30 minutes" → seconds. */
export function parseCaDuration(description: string): number | null {
  // Multi-kill tasks ("5 times within 10 minutes") aren't a single-kill benchmark.
  if (/\btimes\b|\bkills?\b.*\bwithin\b/i.test(description) && !/\bcomplete\b/i.test(description)) return null;
  const clock = description.match(/(?:less than|under|of|within)\s+(\d+):(\d{2})(?::(\d{2}))?/i);
  if (clock) {
    const [a, b, c] = [Number(clock[1]), Number(clock[2]), clock[3] != null ? Number(clock[3]) : null];
    return c != null ? a * 3600 + b * 60 + c : a * 60 + b;
  }
  const m = description.match(/(?:less than|under|within)\s+(?:(\d+)\s+minutes?)?(?:\s*(?:and\s+)?(\d+)\s+seconds?)?/i);
  if (m && (m[1] || m[2])) return Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0);
  return null;
}

const TIER_RANK: Record<CaTier, number> = { Easy: 1, Medium: 2, Hard: 3, Elite: 4, Master: 5, Grandmaster: 6 };

/**
 * The speed benchmark per boss: among its speed tasks of the HIGHEST tier, the most lenient time.
 * Raids list several team sizes; we can't always tell a PB's scale, so the lenient target keeps a
 * trio PB from reading as slow against a five-man record.
 */
const SPEED_TARGETS = (() => {
  const best = new Map<string, { rank: number; seconds: number }>();
  const tasks = (caJson as { tasks: { monster: string | null; tier: CaTier; type: string | null; description: string }[] }).tasks;
  for (const t of tasks) {
    if (t.type !== 'Speed') continue;
    const key = bossKeyForName(t.monster);
    if (!key) continue;
    const secs = parseCaDuration(t.description);
    if (!secs) continue;
    const rank = TIER_RANK[t.tier] ?? 0;
    const cur = best.get(key);
    if (!cur || rank > cur.rank || (rank === cur.rank && secs > cur.seconds)) best.set(key, { rank, seconds: secs });
  }
  return new Map([...best].map(([k, v]) => [k, v.seconds]));
})();

/** A recent-activity window counts as "doing it now" from about this much play time. */
const RECENT_PLAY_MINUTES = 75;
/** KC know-how tops out around this many hours spent at the content. */
const FULL_KNOWHOW_HOURS = 20;

let cache: ActivitySpec[] | null = null;

/** Every BOSSES activity as a spec. Overrides (balance_rates.requirements) merge by key. */
export function activitySpecs(overrides?: Record<string, RequirementRow> | null): ActivitySpec[] {
  if (!overrides && cache) return cache;
  const specs = BOSSES.map((b): ActivitySpec => {
    const req = { ...(REQUIREMENTS[b.key] ?? {}), ...(overrides?.[b.key] ?? {}) };
    const minutes = killMinutes(b.key) ?? 3;
    return {
      key: b.key,
      label: b.label,
      hard: req.hard ?? {},
      realistic: req.realistic ?? {},
      pureFriendly: !!req.pureFriendly,
      ironGear: (req.ironGear ?? []).map((g) => g.map((i) => i.toLowerCase())),
      related: req.related ?? [],
      fullKc: MARKER_FULL_KC.get(b.key) ?? Math.min(500, Math.max(3, Math.round((FULL_KNOWHOW_HOURS * 60) / minutes))),
      recentKills: Math.max(2, Math.round(RECENT_PLAY_MINUTES / minutes)),
      speedTargetSeconds: SPEED_TARGETS.get(b.key) ?? null,
    };
  });
  if (!overrides) cache = specs;
  return specs;
}
