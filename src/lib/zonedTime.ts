// Wall-clock time in a named zone, without a date library.
//
// Everything Anvil stores is UTC, which is right for a record and wrong for a schedule: "missions
// drop at 20:00" means 20:00 where the clan plays, and a clan that plays in London expects the same
// hour either side of the DST switch. So the schedule is written in local wall time plus an IANA
// zone, and converted here.
//
// The whole trick is that Intl can render an instant in a zone but not parse one back. Rendering an
// instant and reading its fields as if they were UTC gives the zone's offset at that instant, and
// subtracting it turns a wall time into the instant that shows it. Once, then again against the
// answer, because near a DST jump the first offset is the one on the wrong side of the boundary.

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      // h23 rather than hour12:false — some engines render midnight as "24" under the latter.
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(timeZone, f);
  }
  return f;
}

export interface ZonedFields {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hour: number; // 0-23
  minute: number;
  second: number;
  /** 0 = Sunday, matching Date#getUTCDay and the perDay array a schedule is written with. */
  weekday: number;
}

/** Is this a zone Intl actually knows? Guards config that arrives as a string from a form. */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    formatterFor(timeZone).format(0);
    return true;
  } catch {
    return false;
  }
}

/** The wall-clock fields an instant shows in a zone. Falls back to UTC for an unknown zone. */
export function zonedFields(instantMs: number, timeZone: string): ZonedFields {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = formatterFor(timeZone).formatToParts(instantMs);
  } catch {
    parts = formatterFor('UTC').formatToParts(instantMs);
  }
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const year = get('year');
  const month = get('month');
  const day = get('day');
  // Weekday from the CIVIL date, not from the instant: the two disagree either side of midnight.
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return { year, month, day, hour: get('hour'), minute: get('minute'), second: get('second'), weekday };
}

/** The zone's offset from UTC at an instant, in ms (positive east of Greenwich). */
export function zoneOffsetMs(instantMs: number, timeZone: string): number {
  const f = zonedFields(instantMs, timeZone);
  const asUtc = Date.UTC(f.year, f.month - 1, f.day, f.hour, f.minute, f.second);
  // Intl drops sub-second precision; round the instant the same way so the difference is the offset
  // and not the offset plus a few hundred milliseconds.
  return asUtc - Math.floor(instantMs / 1000) * 1000;
}

/**
 * The instant at which a zone shows this wall time.
 *
 * Two passes: the first offset is measured at the same fields read as UTC, which is up to a day off
 * only near a transition; the second is measured at the answer, which is on the right side of it.
 * A wall time that a spring-forward skips resolves to the instant just after the jump, and one that
 * an autumn fall-back repeats resolves to the first of the two — both defensible, and neither ever
 * produces a schedule that silently drops a day.
 */
export function zonedTimeToUtcMs(
  fields: { year: number; month: number; day: number; hour: number; minute: number },
  timeZone: string,
): number {
  const asUtc = Date.UTC(fields.year, fields.month - 1, fields.day, fields.hour, fields.minute);
  const first = asUtc - zoneOffsetMs(asUtc, timeZone);
  return asUtc - zoneOffsetMs(first, timeZone);
}

/** 'YYYY-MM-DD' for the local civil date at an instant — the key a day's schedule is built under. */
export function localDayKey(instantMs: number, timeZone: string): string {
  const f = zonedFields(instantMs, timeZone);
  return `${f.year}-${String(f.month).padStart(2, '0')}-${String(f.day).padStart(2, '0')}`;
}

/** Split a 'YYYY-MM-DD' key back into fields, plus the weekday it falls on. */
export function dayKeyFields(dayKey: string): { year: number; month: number; day: number; weekday: number } {
  const [y, m, d] = dayKey.split('-').map((n) => parseInt(n, 10));
  const year = Number.isFinite(y) ? y : 1970;
  const month = Number.isFinite(m) ? m : 1;
  const day = Number.isFinite(d) ? d : 1;
  return { year, month, day, weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay() };
}

/** The local day `offset` days after `dayKey`. Pure civil arithmetic — no zone needed. */
export function addLocalDays(dayKey: string, offset: number): string {
  const f = dayKeyFields(dayKey);
  const d = new Date(Date.UTC(f.year, f.month - 1, f.day + offset));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/** 'HH:MM' → minutes past local midnight, or null when it isn't a time. */
export function parseHhMm(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

/** Minutes past midnight → 'HH:MM', for rendering a computed slot back to a human. */
export function formatHhMm(minutes: number): string {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
