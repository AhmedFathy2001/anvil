// Pure derivations behind the newer recap superlatives — kept out of lib/eventRecap (which pulls in
// the DB) so they can be unit-tested directly, and so the "where does this number come from?"
// question has one small file to answer.
//
// Deliberately imports NOTHING: that's what lets Node's native type-stripping run the tests without
// a bundler resolving the `@/` alias. Display labels that need the boss catalogue live in
// lib/eventRecap instead.

/**
 * Which slice of the day an action landed in, in the actor's OWN timezone when their sign-up
 * recorded one. Falling back to UTC is deliberate: that's game time, and a Night Owl award computed
 * in server time would just crown whoever lives furthest from the server.
 *
 * Returns null only when the timestamp itself is unparseable.
 */
export function localHour(iso: string | null | undefined, timezone: string | null | undefined): number | null {
  if (!iso) return null;
  // The database default writes "YYYY-MM-DD HH:MM:SS" with no zone marker; it IS UTC, so say so
  // rather than letting the runtime read it as local time.
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(iso) ? `${iso.replace(' ', 'T')}Z` : iso;
  const ms = Date.parse(normalized);
  if (Number.isNaN(ms)) return null;
  const utcHour = new Date(ms).getUTCHours();
  if (!timezone) return utcHour;
  try {
    const formatted = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      hour12: false,
      timeZone: timezone,
    }).format(new Date(ms));
    const parsed = Number(formatted);
    return Number.isFinite(parsed) ? parsed % 24 : utcHour;
  } catch {
    // Unrecognised tz string from a free-text sign-up field — fall back rather than throw.
    return utcHour;
  }
}

/** 00:00–05:59 in the actor's own time. */
export function isNightHour(hour: number): boolean {
  return hour < 6;
}

/** 06:00–08:59 — up before the clan, not still up from last night. */
export function isEarlyHour(hour: number): boolean {
  return hour >= 6 && hour < 9;
}

export interface KeyedGain {
  name: string;
  gained: number;
}

/** The six real clue tiers, easiest first. `all` is their sum, not a tier — never counted here. */
const CLUE_TIERS = ['beginner', 'easy', 'medium', 'hard', 'elite', 'master'] as const;

export interface ClueGain {
  /** Caskets opened across every tier during the event. */
  total: number;
  /** The tier they opened most of, for the award's detail line. Null when nothing moved. */
  topTier: string | null;
  topTierGained: number;
}

/**
 * Caskets opened between two hiscores snapshots, by tier.
 *
 * Summed from the SIX TIERS rather than read off `clues.all`, for two reasons: `all` is unranked
 * (-1) for accounts with only a handful of clues, where the individual tiers still chart; and the
 * per-tier split is what makes the award say "412 caskets · mostly hard" instead of a bare number.
 *
 * Same free-data trick as biggestGain: one hiscores read returns the whole account, so these
 * counters are already sitting in the two snapshots the recap holds.
 */
export function clueGain(
  baselineJson: string | null | undefined,
  currentJson: string | null | undefined,
): ClueGain | null {
  if (!baselineJson || !currentJson) return null;
  let baseline: Record<string, Record<string, { score?: number }>>;
  let current: typeof baseline;
  try {
    baseline = JSON.parse(baselineJson);
    current = JSON.parse(currentJson);
  } catch {
    return null;
  }
  const before = baseline?.clues ?? {};
  const after = current?.clues ?? {};

  let total = 0;
  let topTier: string | null = null;
  let topTierGained = 0;
  for (const tier of CLUE_TIERS) {
    // Hiscores reports -1 for unranked, so floor both sides: someone crossing onto the board gained
    // what they now have, not that plus one.
    const now = Math.max(0, Number(after?.[tier]?.score ?? 0));
    const then = Math.max(0, Number(before?.[tier]?.score ?? 0));
    const gained = now - then;
    if (gained <= 0) continue;
    total += gained;
    if (gained > topTierGained) {
      topTierGained = gained;
      topTier = tier;
    }
  }
  return total > 0 ? { total, topTier, topTierGained } : null;
}

/**
 * The single biggest per-key gain between two hiscores snapshots.
 *
 * Both snapshots are already stored per player — `players.statsSnapshot` is frozen at enrollment,
 * `players.cachedStats` is refreshed every cron tick — and the fetch that produced them returns the
 * WHOLE account. So reading every boss and every skill here costs nothing extra: no new request, no
 * new row, just a diff of two objects the recap already holds. That's what lets these awards cover
 * content no tile ever tracked.
 */
export function biggestGain(
  baselineJson: string | null | undefined,
  currentJson: string | null | undefined,
  section: 'bosses' | 'skills',
): KeyedGain | null {
  if (!baselineJson || !currentJson) return null;
  let baseline: Record<string, Record<string, { score?: number; xp?: number }>>;
  let current: typeof baseline;
  try {
    baseline = JSON.parse(baselineJson);
    current = JSON.parse(currentJson);
  } catch {
    return null;
  }
  const before = baseline?.[section] ?? {};
  const after = current?.[section] ?? {};
  const field: 'score' | 'xp' = section === 'bosses' ? 'score' : 'xp';

  let best: KeyedGain | null = null;
  for (const [key, valueAfter] of Object.entries(after ?? {})) {
    if (key === 'overall') continue; // the sum of everything else — never the story
    // Hiscores reports -1 for unranked. Floor both sides at 0 so crossing onto the board reads as
    // "gained what you have", not "gained value + 1".
    const now = Math.max(0, Number(valueAfter?.[field] ?? 0));
    const then = Math.max(0, Number(before?.[key]?.[field] ?? 0));
    const gained = now - then;
    if (gained > 0 && (!best || gained > best.gained)) {
      best = { name: key, gained };
    }
  }
  return best;
}
