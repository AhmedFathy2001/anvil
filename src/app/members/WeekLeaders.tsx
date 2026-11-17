import ClanLink from '@/components/ClanLink';

/**
 * This week's top three, in one line above the roster. The full weekly block (the podium, the
 * chasers, the chart) sits under the roster since the list moved up; this keeps the "who is leading"
 * answer on the first screen without pushing the list back down.
 */
export default function WeekLeaders({ topWeek }: { topWeek: { rsn: string; hours: number }[] }) {
  const top = topWeek.slice(0, 3);
  if (top.length === 0) return null;
  const place = ['text-gold-light', 'text-foreground/80', 'text-amber-600'];
  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-card-border bg-card-bg px-4 py-2.5">
      <span className="text-[11px] uppercase tracking-widest text-text-muted">This week</span>
      <ol className="flex min-w-0 flex-1 flex-wrap items-center gap-x-5 gap-y-1.5">
        {top.map((t, i) => (
          <li key={t.rsn} className="flex min-w-0 items-baseline gap-1.5 text-sm">
            <span className={`font-bold tabular-nums ${place[i]}`}>{i + 1}</span>
            <ClanLink href={`/members/${encodeURIComponent(t.rsn)}`} className="truncate font-medium hover:text-gold">
              {t.rsn}
            </ClanLink>
            <span className="tabular-nums text-accent-green-light">+{t.hours.toFixed(1)}h</span>
          </li>
        ))}
      </ol>
      <a href="#clan-week" className="shrink-0 text-xs text-gold hover:underline">
        The full week ↓
      </a>
    </div>
  );
}
