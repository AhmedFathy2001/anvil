/**
 * The schedule's "Fill the gap" links carry `?start=YYYY-MM-DD&end=YYYY-MM-DD` (the first and last empty
 * day). Read them back, accepting real calendar dates only, with the end never before the start.
 */
export interface GapPrefill {
  start: string;
  end: string | null;
}

function realDay(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const t = new Date(Date.UTC(y, mo - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== mo - 1 || t.getUTCDate() !== d) return null;
  return v;
}

export function parseGapPrefill(start: unknown, end: unknown): GapPrefill | null {
  const s = realDay(Array.isArray(start) ? start[0] : start);
  if (!s) return null;
  const e = realDay(Array.isArray(end) ? end[0] : end);
  return { start: s, end: e && e >= s ? e : null };
}

/** Local midnight at the start of a YYYY-MM-DD day, plus `plusDays` whole days, as an ISO instant (browser zone). */
export function localDayIso(day: string, plusDays = 0, hour = 0): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d + plusDays, hour, 0, 0, 0).toISOString();
}
