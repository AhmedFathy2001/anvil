// Shared event time/countdown logic.
//
// Two display modes the UI switches between:
//   - exact time:  shown when the relevant moment is more than 24h away
//   - live countdown: shown when it's within 24h (start of an upcoming event,
//     or end of an active one)
//
// All formatting is locale/timezone dependent, so it must only run on the
// client (after mount) to avoid SSR hydration mismatches.

const DAY_MS = 86_400_000;

export type EventPhase = 'upcoming' | 'active' | 'ended' | 'force-ended' | 'none';

export interface EventTimeState {
  phase: EventPhase;
  /** Timestamp (ms) the countdown / exact-time refers to, or null. */
  target: number | null;
  /** True when the target is within 24h and a live countdown should be shown. */
  imminent: boolean;
}

export function eventTimeState({
  startDate,
  endDate,
  forceEndedAt,
  now = Date.now(),
}: {
  startDate?: string | null;
  endDate?: string | null;
  forceEndedAt?: string | null;
  now?: number;
}): EventTimeState {
  if (forceEndedAt) {
    return { phase: 'force-ended', target: new Date(forceEndedAt).getTime(), imminent: false };
  }

  const start = startDate ? new Date(startDate).getTime() : null;
  const end = endDate ? new Date(endDate).getTime() : null;

  // Not started yet → count down to the start.
  if (start !== null && start > now) {
    return { phase: 'upcoming', target: start, imminent: start - now < DAY_MS };
  }
  // Running → count down to the end.
  if (end !== null && end > now) {
    return { phase: 'active', target: end, imminent: end - now < DAY_MS };
  }
  // Past its end date.
  if (end !== null) {
    return { phase: 'ended', target: end, imminent: false };
  }
  return { phase: 'none', target: null, imminent: false };
}

/** Exact local date + time, e.g. "Jun 28, 8:00 PM". */
export function formatExactTime(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const UTC_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/**
 * The same instant rendered on the UTC wall clock, e.g. "Jun 26, 2026, 20:00 UTC".
 * Shown next to local-time date inputs so admins can see what they're actually
 * storing (the API persists UTC) instead of guessing from their own timezone.
 * Built from getUTC* parts so it's deterministic regardless of locale.
 */
export function formatUtcHint(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${UTC_MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}

/** Live countdown, e.g. "5h 02m 11s" or "12m 04s". Seconds/minutes zero-padded. */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return '0s';
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86_400);
  const hours = Math.floor((totalSec % 86_400) / 3_600);
  const mins = Math.floor((totalSec % 3_600) / 60);
  const secs = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (days > 0) return `${days}d ${pad(hours)}h ${pad(mins)}m`;
  if (hours > 0) return `${hours}h ${pad(mins)}m ${pad(secs)}s`;
  if (mins > 0) return `${mins}m ${pad(secs)}s`;
  return `${secs}s`;
}

/**
 * "Jan 5, 2026 · 14:30" — the one way this app writes a date and time to a person.
 *
 * The create form used to mix three: the picker's own format, `toLocaleString()` on the "Ends"
 * line, and `toLocaleString()` again in the panel summary, so one window read as three windows.
 */
export function formatLocalDateTime(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const date = d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date} · ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
