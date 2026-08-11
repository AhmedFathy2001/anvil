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
  // SQLite's datetime('now') writes "YYYY-MM-DD HH:MM:SS" with no zone marker; it IS UTC, so say so
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
