import type { LockerTrophy } from '@/lib/profileLocker';

// What you've won. Derived — nothing here is a new thing to track, and nothing here scores.

function Card({ title, note, children }: { title: string; note?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="border border-card-border rounded-xl bg-card-bg p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="w-1 h-5 bg-gold rounded-full" />
        <h2 className="text-lg font-semibold">{title}</h2>
        {note && <span className="ml-auto text-xs text-text-muted">{note}</span>}
      </div>
      {children}
    </section>
  );
}

/**
 * The case shows locked slots as well as earned ones. An empty trophy case that says nothing is
 * just a blank card; one that shows five outlines says what's collectable here.
 */
export function TrophyCase({ trophies }: { trophies: LockerTrophy[] }) {
  const earned = trophies.filter((t) => t.earned).length;
  return (
    <Card
      title="Trophy case"
      // "7 of 7" says nothing once there's nothing left to collect — count up, not out of.
      note={earned === trophies.length ? `${earned} earned` : `${earned} of ${trophies.length}`}
    >
      <div className="grid grid-cols-3 gap-2.5">
        {trophies.map((t) => (
          <div
            key={t.key}
            title={t.earned ? `${t.label}${t.value ? ` — ${t.value}` : ''}` : `Not yet: ${t.value ?? t.label}`}
            className={`relative flex flex-col items-center text-center rounded-lg px-1.5 pt-3 pb-2.5 min-h-[104px] border ${
              t.earned ? 'border-card-border bg-brown-dark/50' : 'border-dashed border-card-border opacity-55'
            }`}
          >
            {t.count && (
              <span className="absolute top-1.5 right-1.5 font-mono text-[10px] font-bold text-gold-light bg-gold/15 rounded-full px-1.5">
                ×{t.count}
              </span>
            )}
            <span
              className={`w-10 h-10 rounded-full grid place-items-center text-lg mb-1.5 border ${
                t.earned ? 'bg-gold/12 border-gold/30' : 'border-card-border grayscale'
              }`}
              aria-hidden
            >
              {t.emoji}
            </span>
            <span className="text-[11.5px] font-bold leading-tight">{t.label}</span>
            {t.value && (
              <span className="font-mono text-[10px] text-text-muted leading-tight mt-auto pt-1 truncate max-w-full">
                {t.value}
              </span>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
