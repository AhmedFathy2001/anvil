// A running clock as a person reads it: "9:05" under an hour, "15h 53m" under a day, "2d 3h" beyond.
// A draft with a long pick clock showed "953:12" (minutes and seconds). Pure (no `@/` imports).

export function formatClock(totalSeconds: number): string {
  const total = Math.max(0, Math.floor(totalSeconds));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${m}:${String(total % 60).padStart(2, '0')}`;
}
