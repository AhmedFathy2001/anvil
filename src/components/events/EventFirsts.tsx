import type { EventFirst } from '@/lib/eventFirsts';

/**
 * The board's firsts — who opened it, who drew first blood.
 *
 * These are facts about the event, not about the leaderboard: a team that finishes last still got
 * the board moving, and that moment is worth keeping. They're stamped from `completions.completedAt`
 * so they never change once earned — unlike the standings above them, which move all week.
 */
export default function EventFirsts({ firsts }: { firsts: EventFirst[] }) {
  if (firsts.length === 0) return null;

  const cards = (
    <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fill,minmax(228px,1fr))]">
      {firsts.map((f) => (
        <div key={f.key} className="rounded-xl border border-card-border bg-card-bg p-3">
          <div className="flex items-center gap-2">
            <span aria-hidden className="text-base leading-none">
              {f.emoji}
            </span>
            <span className="text-[12.5px] font-bold">{f.title}</span>
            <span className="ml-auto shrink-0 font-mono text-[10.5px] text-text-muted">{when(f.at)}</span>
          </div>

          <div className="mt-2 flex items-center gap-2 border-t border-card-border/70 pt-2 text-[13px]">
            {f.teamColor && (
              <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: f.teamColor }} />
            )}
            <span className="min-w-0 truncate font-semibold">{f.who}</span>
          </div>
          <div className="mt-0.5 truncate text-[11px] text-text-muted">{f.tileLabel}</div>
        </div>
      ))}
    </div>
  );

  return (
    <>
      {/* Phones: folded to one row, so the board stays near the top; a tap opens the cards. */}
      <details className="group mb-3 rounded-xl border border-card-border bg-card-bg sm:hidden">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 text-[15px] font-bold [&::-webkit-details-marker]:hidden">
          <span aria-hidden className="h-4 w-1 rounded-full bg-gold" />
          Firsts
          <span className="font-normal text-text-muted">({firsts.length})</span>
          <span aria-hidden className="ml-auto text-text-muted group-open:hidden">+</span>
          <span aria-hidden className="ml-auto hidden text-text-muted group-open:inline">−</span>
        </summary>
        <div className="px-3 pb-3">{cards}</div>
      </details>

      <section className="mb-6 max-sm:hidden">
        <div className="mb-2.5 flex flex-wrap items-center gap-3">
          <h2 className="flex items-center gap-2 text-[15px] font-bold">
            <span aria-hidden className="h-4 w-1 rounded-full bg-gold" />
            Firsts
          </h2>
          <span className="text-[11.5px] text-text-muted">stamped when they happened — these don&apos;t change</span>
        </div>
        {cards}
      </section>
    </>
  );
}

/** Timestamp columns hold "YYYY-MM-DD HH:MM:SS" with no zone marker, and it IS UTC — say so. */
function when(raw: string): string {
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(raw) ? `${raw.replace(' ', 'T')}Z` : raw;
  const ms = Date.parse(normalized);
  if (Number.isNaN(ms)) return '';
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
