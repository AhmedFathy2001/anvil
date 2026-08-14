'use client';

/**
 * Whose board am I looking at?
 *
 * Every format except a bounty is multi-claim: each team can complete every tile, and they all do.
 * A board that draws all of them at once is a soup of dots that answers "has anyone done this"
 * when the question a member actually has is "have WE done this, and what should we do next".
 *
 * So the board gets a lens. "All teams" keeps the shared view (who's ahead, what nobody has
 * touched); picking a team redraws the board as that team's own — their fills, their progress,
 * their next tile.
 */
export default function TeamLens({
  teams,
  value,
  onChange,
  className = '',
}: {
  teams: { id: number; name: string; color: string }[];
  /** null = all teams. */
  value: number | null;
  onChange: (teamId: number | null) => void;
  className?: string;
}) {
  if (teams.length < 2) return null;
  return (
    <div className={`inline-flex flex-wrap items-center gap-1 ${className}`}>
      <span className="mr-1 text-[11px] uppercase tracking-wider text-text-muted">Viewing as</span>
      <button
        type="button"
        onClick={() => onChange(null)}
        aria-pressed={value === null}
        className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
          value === null ? 'border-gold bg-gold/20 text-gold' : 'border-card-border text-text-muted hover:border-gold/40'
        }`}
      >
        All teams
      </button>
      {teams.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          aria-pressed={value === t.id}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
            value === t.id ? 'text-foreground' : 'border-card-border text-text-muted hover:border-gold/40'
          }`}
          style={value === t.id ? { borderColor: t.color, backgroundColor: `${t.color}22` } : undefined}
        >
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: t.color }} />
          {t.name}
        </button>
      ))}
    </div>
  );
}
