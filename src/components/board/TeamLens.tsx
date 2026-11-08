'use client';

import Select from '@/components/Select';

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
 *
 * A players board (solo, or a big board of one-person teams) or a board of many teams
 * (lib/standingsWindow) would be a wall of buttons, so `compact` draws "Everyone", the viewer's own entrants, and a searchable picker for
 * anyone else.
 */
export default function TeamLens({
  teams,
  value,
  onChange,
  className = '',
  compact = false,
  mine = [],
  noun = 'player',
}: {
  teams: { id: number; name: string; color: string }[];
  /** null = all teams. */
  value: number | null;
  onChange: (teamId: number | null) => void;
  className?: string;
  /** A players board: Everyone + your own + a search for the rest, not a button per team. */
  compact?: boolean;
  /** The viewer's own teams, drawn as buttons in compact mode. */
  mine?: number[];
  /** Compact mode's wording: a players board says "You", a many-teams board "Your team". */
  noun?: 'player' | 'team';
}) {
  if (teams.length < 2) return null;
  if (compact) return <CompactLens teams={teams} value={value} onChange={onChange} className={className} mine={mine} noun={noun} />;
  return (
    <div className={`inline-flex flex-wrap items-center gap-1 ${className}`}>
      <span className="mr-1 text-[11px] uppercase tracking-wider text-text-muted">Show progress for</span>
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

const chip = (on: boolean) =>
  `inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
    on ? 'border-gold bg-gold/20 text-gold' : 'border-card-border text-text-muted hover:border-gold/40'
  }`;

function CompactLens({
  teams,
  value,
  onChange,
  className,
  mine,
  noun,
}: {
  teams: { id: number; name: string; color: string }[];
  value: number | null;
  onChange: (teamId: number | null) => void;
  className: string;
  mine: number[];
  noun: 'player' | 'team';
}) {
  const own = new Set(mine);
  const yours = teams.filter((t) => own.has(t.id));
  const others = teams
    .filter((t) => !own.has(t.id))
    .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
  const otherPicked = value != null && others.some((t) => t.id === value);
  return (
    <div className={`inline-flex flex-wrap items-center gap-1 ${className}`}>
      <span className="mr-1 text-[11px] uppercase tracking-wider text-text-muted">Show progress for</span>
      <button type="button" onClick={() => onChange(null)} aria-pressed={value === null} className={chip(value === null)}>
        Everyone
      </button>
      {yours.map((t) => (
        <button key={t.id} type="button" onClick={() => onChange(t.id)} aria-pressed={value === t.id} className={chip(value === t.id)}>
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: t.color }} />
          {yours.length > 1 ? t.name : noun === 'team' ? 'Your team' : 'You'}
        </button>
      ))}
      {others.length > 0 && (
        <Select
          value={otherPicked ? String(value) : ''}
          onChange={(v) => onChange(v ? Number(v) : null)}
          options={others.map((t) => ({ value: String(t.id), label: t.name, dot: t.color }))}
          placeholder={yours.length ? (noun === 'team' ? 'Another team…' : 'Someone else…') : `Pick a ${noun}…`}
          ariaLabel={`Show progress for a ${noun}`}
          searchable
          className="w-44"
        />
      )}
    </div>
  );
}
