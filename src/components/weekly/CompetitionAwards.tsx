import type { CompetitionAward } from '@/lib/competitionAwards';

/**
 * The week's awards.
 *
 * Deliberately not a side panel. A leaderboard says who won; these say what KIND of week everyone
 * had — who came out swinging, who ground it every day, who was quiet until Saturday — and that is
 * the part people actually talk about, so it sits where it can be seen.
 *
 * Every award is decided by the shape of the days rather than by when a number arrived (see
 * lib/competitionAwards), so a member whose hiscores only got swept this morning can still win one.
 */
export default function CompetitionAwards({ awards }: { awards: CompetitionAward[] }) {
  if (awards.length === 0) return null;

  return (
    <section className="mb-7">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h2 className="flex items-center gap-2 text-[17px] font-bold">
          <span aria-hidden className="h-5 w-1 rounded-full bg-gold" />
          Awards
        </h2>
        <span className="text-xs text-text-muted">
          the shape of the week — updates as the sweep lands
        </span>
      </div>

      <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fill,minmax(232px,1fr))]">
        {awards.map((a) => (
          <div
            key={a.key}
            className="rounded-xl border border-card-border bg-card-bg p-3.5 transition-colors hover:border-gold/40"
          >
            <div className="flex items-start gap-2.5">
              <span aria-hidden className="text-lg leading-none">
                {a.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-bold">{a.title}</div>
                <div className="text-[11px] text-text-muted">{a.blurb}</div>
              </div>
            </div>

            <div className="mt-2.5 flex items-baseline gap-2 border-t border-card-border/70 pt-2.5">
              <span className="min-w-0 truncate text-[13px] font-semibold">{a.who}</span>
              <span className="ml-auto shrink-0 font-mono text-[13px] font-bold text-gold-light">{a.value}</span>
            </div>
            {a.detail && <div className="mt-1 truncate text-[11px] text-text-muted">{a.detail}</div>}
          </div>
        ))}
      </div>
    </section>
  );
}
