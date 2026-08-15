// Reading timestamps out of columns that hold two different formats.
//
// Anvil's text timestamp columns were written by two different things and it shows:
//
//   SQLite  `datetime('now')`  → "2026-08-15 12:00:00"        (space, no zone, always UTC)
//   JS      `toISOString()`    → "2026-08-15T12:00:00.000Z"   (T, explicit Z)
//
// Both are UTC and both sort correctly against their own kind, which is why this stayed invisible
// for so long. It bites in two places:
//
//   Parsing   `Date.parse("2026-08-15 12:00:00")` is implementation-defined — V8 reads it as
//             LOCAL time, so an age computed from it is off by the reader's UTC offset. Patching
//             it by hand ("replace the space, append a Z") turns an already-ISO string into
//             "…000ZZ", which parses to NaN — a real bug this replaced.
//
//   Comparing "2026-08-15 …" < "2026-08-15T…" because space (0x20) sorts below T (0x54), so a
//             `>= cutoff` filter silently drops or keeps the boundary day depending on which
//             process happened to write the row.
//
// So: never hand-patch these strings at the call site. Parse with `parseStamp`, and filter on the
// date prefix with `dayKey`, which is blind to the difference.

/**
 * Milliseconds since epoch for a stored timestamp, in either format.
 *
 * Returns null rather than NaN for anything unparseable, so callers get a value they have to
 * handle instead of one that quietly poisons the arithmetic downstream.
 */
export function parseStamp(value: string | null | undefined): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  // Already explicit about its zone (Z, +01:00, -0500) — trust it as written.
  const iso = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(trimmed)
    ? trimmed
    : // SQLite's "YYYY-MM-DD HH:MM:SS" (and the rare "YYYY-MM-DDTHH:MM:SS" with no zone) are
      // both UTC by construction, so say so rather than letting the engine guess local.
      `${trimmed.replace(' ', 'T')}Z`;

  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

/** Whole days between a stored timestamp and now, or null if it can't be read. */
export function daysSince(value: string | null | undefined, now: number): number | null {
  const ms = parseStamp(value);
  if (ms == null) return null;
  return Math.max(0, Math.floor((now - ms) / 86_400_000));
}

/**
 * The "YYYY-MM-DD" prefix a day-window filter should compare against.
 *
 * Both formats begin with the same ten characters, so comparing only that prefix is correct
 * whichever process wrote the row — and day granularity is all a "last 7 days" window needs.
 */
export function dayKey(now: number, daysAgo = 0): string {
  return new Date(now - daysAgo * 86_400_000).toISOString().slice(0, 10);
}
