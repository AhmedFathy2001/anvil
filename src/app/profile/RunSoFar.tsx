import type { LockerHistoryRow } from '@/lib/profileLocker';
import ClanLink from '@/components/ClanLink';

// Everything this person has actually competed in, newest first. Events and weeklies interleave on
// purpose: a member's year is one run, not two lists.

export default function RunSoFar({
  rows,
  totals,
  focusRsn,
}: {
  rows: LockerHistoryRow[];
  totals: { events: number; weeklies: number };
  focusRsn: string | null;
}) {
  if (rows.length === 0) return null;

  const parts: string[] = [];
  if (totals.events > 0) parts.push(`${totals.events} event${totals.events === 1 ? '' : 's'}`);
  if (totals.weeklies > 0) parts.push(`${totals.weeklies} week${totals.weeklies === 1 ? '' : 's'}`);

  return (
    <section className="border border-card-border rounded-xl bg-card-bg p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-1 h-5 bg-gold rounded-full" />
        <h2 className="text-lg font-semibold">Your run so far</h2>
        {focusRsn && (
          <ClanLink
            href={`/members/${encodeURIComponent(focusRsn)}`}
            className="ml-auto text-xs text-text-muted hover:text-gold-light"
          >
            All {parts.join(' & ')} →
          </ClanLink>
        )}
      </div>

      <div className="grid">
        {rows.map((row) => (
          <ClanLink
            key={row.key}
            href={row.href}
            className="flex items-baseline gap-3 py-2.5 px-0.5 border-b border-card-border/60 last:border-b-0 hover:bg-card-bg-hover/40 rounded transition-colors"
          >
            <span
              className={`shrink-0 min-w-[44px] text-center font-mono text-[11px] font-bold rounded-full border px-2 py-0.5 ${
                row.place === 1
                  ? 'text-gold-light border-gold/45 bg-gold/12'
                  : row.place != null && row.place <= 3
                    ? 'border-card-border'
                    : 'border-card-border text-text-muted'
              }`}
            >
              {row.place != null ? `${row.place}${ordinal(row.place)}` : '—'}
            </span>
            <span className="min-w-0 font-semibold text-sm truncate">
              {row.name}
              <span className="text-text-muted font-normal"> · {row.detail}</span>
            </span>
            {row.value && (
              <span className="ml-auto shrink-0 font-mono text-[12.5px] tabular-nums">{row.value}</span>
            )}
            <span className={`shrink-0 font-mono text-[11.5px] text-text-muted w-8 text-right ${row.value ? '' : 'ml-auto'}`}>
              {row.endedOn
                ? new Date(row.endedOn).toLocaleDateString(undefined, { month: 'short', timeZone: 'UTC' })
                : ''}
            </span>
          </ClanLink>
        ))}
      </div>
    </section>
  );
}

function ordinal(n: number): string {
  if (n % 100 >= 11 && n % 100 <= 13) return 'th';
  return ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th';
}
