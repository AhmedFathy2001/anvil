'use client';

/**
 * The whole board in one glance, for the boards that don't fit on a screen.
 *
 * A leagues event can run 200 tasks. The list is the right way to work through them, but it can
 * never answer "how much is left" or "where are the untouched ones" without a lot of scrolling —
 * so this draws one square per tile, in board order, coloured by what it is to the team you're
 * viewing as: done, started, or untouched. Elite tiles get a ring, because that's where the points
 * that decide the event are.
 */

export interface MinimapTile {
  id: number;
  status: 'completed' | 'in_progress' | 'not_started';
  /** Marked as high-value (top tier) — ringed rather than coloured, so status stays readable. */
  top?: boolean;
  label: string;
  points?: number | null;
}

export default function BoardMinimap({
  tiles,
  lensName,
  onTileClick,
}: {
  tiles: MinimapTile[];
  /** Whose progress the shading shows — 'the clan' when no team lens is active. */
  lensName: string;
  onTileClick?: (tileId: number) => void;
}) {
  if (tiles.length < 24) return null; // a board you can already see needs no map of itself
  const done = tiles.filter((t) => t.status === 'completed').length;
  const started = tiles.filter((t) => t.status === 'in_progress').length;

  return (
    <div className="mb-4 rounded-xl border border-card-border bg-card-bg p-3.5">
      <div className="mb-2.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-text-muted">Whole board</span>
        <span className="ml-auto text-[11.5px] text-text-muted">
          <b className="font-semibold text-foreground">{done}</b> of {tiles.length} done
          {started > 0 && (
            <>
              {' '}· <span className="text-amber-300">{started}</span> started
            </>
          )}{' '}
          · {lensName}
        </span>
      </div>
      <div className="grid gap-[3px]" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(11px, 1fr))' }}>
        {tiles.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={onTileClick ? () => onTileClick(t.id) : undefined}
            title={`${t.label}${t.points != null ? ` · ${t.points} pts` : ''}`}
            aria-label={t.label}
            className={`aspect-square rounded-[2px] transition-transform hover:scale-125 ${
              t.status === 'completed'
                ? 'bg-accent-green'
                : t.status === 'in_progress'
                  ? 'bg-amber-400'
                  : 'bg-card-border/70'
            } ${t.top ? 'ring-1 ring-purple-300/70' : ''} ${onTileClick ? 'cursor-pointer' : 'cursor-default'}`}
          />
        ))}
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-text-muted">
        <span className="inline-flex items-center gap-1.5">
          <i className="block h-2.5 w-2.5 rounded-[2px] bg-accent-green" /> done
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="block h-2.5 w-2.5 rounded-[2px] bg-amber-400" /> started
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="block h-2.5 w-2.5 rounded-[2px] bg-card-border/70" /> untouched
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="block h-2.5 w-2.5 rounded-[2px] ring-1 ring-purple-300/70" /> top tier
        </span>
      </div>
    </div>
  );
}
