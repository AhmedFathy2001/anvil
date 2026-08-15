import type { EventMode } from '@/lib/eventModes';

// A tiny, pure-markup diagram of what each event format's board looks like. Drawn with divs so it
// inherits the theme and costs nothing to ship (no images, no canvas). Used twice on the create
// form: postage-stamp size inside every format card, and larger in the live preview panel.
//
// The shapes are illustrative, not literal — a 12x12 classic board still draws a 5x5 stamp. The
// point is "grid vs list vs track vs one-at-a-time", which is exactly the distinction the format
// names alone were failing to carry.

type Variant = 'card' | 'panel';

const CELL: Record<Variant, string> = {
  card: 'w-2 h-2 rounded-[2px]',
  panel: 'w-4 h-4 rounded-[3px]',
};
const GAP: Record<Variant, string> = { card: 'gap-[3px]', panel: 'gap-1.5' };

const OPEN = 'bg-gold/25 border border-gold/40';
const HIDDEN = 'border border-dashed border-card-border bg-transparent';
const DONE = 'bg-gold border border-gold';
const IDLE = 'border border-card-border bg-brown-dark/60';

function Cell({ kind, variant }: { kind: string; variant: Variant }) {
  return <span className={`${CELL[variant]} ${kind} shrink-0`} aria-hidden />;
}

/** Rows of pill-shaped tasks — the "list" formats (leagues / showdown / lucky draw / ladder). */
function Rows({
  variant,
  rows,
}: {
  variant: Variant;
  rows: { kind: string; width: string; badge?: string }[];
}) {
  // Card rows are a postage-stamp glyph, so they get a fixed narrow track rather than filling the
  // card — left at w-full they read as a progress bar, not a task list.
  const h = variant === 'card' ? 'h-1.5' : 'h-4';
  return (
    <div
      className={`flex flex-col ${variant === 'card' ? 'gap-[3px] w-12' : 'gap-1.5 w-full'}`}
    >
      {rows.map((r, i) => (
        <span key={i} className={`flex items-center ${variant === 'card' ? 'gap-1' : 'gap-2'}`}>
          <span className={`${h} ${r.width} ${r.kind} rounded-[3px]`} aria-hidden />
          {r.badge && variant === 'panel' && (
            <span className="text-[10px] font-mono text-text-muted">{r.badge}</span>
          )}
        </span>
      ))}
    </div>
  );
}

export default function BoardShape({
  mode,
  size,
  variant = 'card',
}: {
  /**
   * 'competition' isn't an EventMode — a weekly competition has no board and no tiles row, it's a
   * different table entirely. It draws here anyway because it's offered as a fifth card in the same
   * picker, and a card in that row without a diagram reads as the odd one out.
   */
  mode: EventMode | 'competition';
  size?: number;
  variant?: Variant;
}) {
  const gap = GAP[variant];

  if (mode === 'competition') {
    // Everyone on the roster, ranked by one number. No board to draw — the standings ARE the thing,
    // so the diagram is the podium: a full bar, then the field falling away behind it.
    return (
      <Rows
        variant={variant}
        rows={[
          { kind: DONE, width: 'w-full', badge: '1st' },
          { kind: OPEN, width: 'w-3/4', badge: '2nd' },
          { kind: IDLE, width: 'w-1/2', badge: '3rd' },
          { kind: IDLE, width: 'w-1/3', badge: '4th' },
        ]}
      />
    );
  }

  if (mode === 'classic') {
    // Square grid at the real N when it's small enough to read, else a 5x5 stand-in.
    const n = size && size >= 2 && size <= 6 ? size : 5;
    return (
      <div className={`grid ${gap}`} style={{ gridTemplateColumns: `repeat(${n}, min-content)` }}>
        {Array.from({ length: n * n }, (_, i) => (
          <Cell key={i} variant={variant} kind={i === 0 || i === n + 1 ? DONE : IDLE} />
        ))}
      </div>
    );
  }

  if (mode === 'race') {
    // A track: finished, finished, current, then locked — order is the whole point.
    const kinds = [DONE, DONE, OPEN, IDLE, IDLE];
    return (
      <div className={`flex items-center ${gap}`}>
        {kinds.map((k, i) => (
          <span key={i} className="flex items-center">
            <Cell variant={variant} kind={k} />
            {i < kinds.length - 1 && (
              <span className={`${variant === 'card' ? 'w-1' : 'w-2'} h-px bg-card-border`} aria-hidden />
            )}
          </span>
        ))}
      </div>
    );
  }

  if (mode === 'leagues') {
    return (
      <Rows
        variant={variant}
        rows={[
          { kind: DONE, width: 'w-full', badge: '25p' },
          { kind: IDLE, width: 'w-4/5', badge: '40p' },
          { kind: IDLE, width: 'w-full', badge: '60p' },
          { kind: IDLE, width: 'w-3/5', badge: '15p' },
        ]}
      />
    );
  }

  if (mode === 'ladder') {
    // Ranked rows — the leaderboard, not the board.
    return (
      <Rows
        variant={variant}
        rows={[
          { kind: DONE, width: 'w-full', badge: '1st' },
          { kind: OPEN, width: 'w-4/5', badge: '2nd' },
          { kind: IDLE, width: 'w-3/5', badge: '3rd' },
          { kind: IDLE, width: 'w-2/5', badge: '4th' },
        ]}
      />
    );
  }

  if (mode === 'bounty') {
    // Exactly one live tile, the rest waiting their turn.
    return (
      <div className={`flex items-center ${gap}`}>
        {[HIDDEN, HIDDEN, OPEN, HIDDEN, HIDDEN].map((k, i) => (
          <Cell key={i} variant={variant} kind={k} />
        ))}
      </div>
    );
  }

  // showdown + luckydraw: a pool that's mostly still hidden. Showdown opens on a schedule,
  // lucky draw opens at random — same shape, and the copy beside it carries the difference.
  const openIdx = mode === 'showdown' ? [0, 1, 5] : [2, 6, 9];
  return (
    <div className={`grid grid-cols-5 ${gap}`}>
      {Array.from({ length: 10 }, (_, i) => (
        <Cell key={i} variant={variant} kind={openIdx.includes(i) ? OPEN : HIDDEN} />
      ))}
    </div>
  );
}
