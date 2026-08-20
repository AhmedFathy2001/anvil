import type { PlayerShape } from '@/lib/playerShape';

/**
 * A player's shape, as a hexagon.
 *
 * Six percentiles, each measured against the clan rather than the game — "ahead of 80% of us at
 * bossing" lands instantly where 42,000,000 XP doesn't. The point is the SILHOUETTE: a spike toward
 * bossing with a flat skilling edge says what kind of account this is in one glance, which is the
 * question a captain has and a rank never answers.
 *
 * An axis with nothing behind it is drawn at the centre and greyed in the legend rather than filled
 * with a zero — never having done a clue is not the same as being bad at clues.
 */

const SIZE = 220;
const CENTER = SIZE / 2;
const RADIUS = SIZE / 2 - 34;
const RINGS = [25, 50, 75, 100];

/** Axis i's point at `pct` of the way out, starting at 12 o'clock and going clockwise. */
function point(index: number, total: number, pct: number): { x: number; y: number } {
  const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
  const r = (RADIUS * Math.max(0, Math.min(100, pct))) / 100;
  return { x: CENTER + r * Math.cos(angle), y: CENTER + r * Math.sin(angle) };
}

const polygon = (pts: { x: number; y: number }[]) => pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

export default function PlayerShapeRadar({ shape, rsn }: { shape: PlayerShape; rsn: string }) {
  if (shape.empty) return null;

  const axes = shape.axes;
  const total = axes.length;
  const filled = axes.map((a, i) => point(i, total, a.pct ?? 0));
  const outline = axes.map((_, i) => point(i, total, 100));

  return (
    <section className="border border-card-border rounded-xl bg-card-bg p-5">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-1 h-5 bg-gold rounded-full" />
        <h2 className="text-lg font-bold">Player shape</h2>
        <span className="text-xs text-text-muted">against the clan, not the game</span>
      </div>
      <p className="text-xs text-text-muted mb-3">
        Each edge is where {rsn} sits among the {shape.tracked} members we hold numbers for. It says what
        kind of account this is — not how good it is.
      </p>

      <div className="flex flex-wrap items-center gap-5">
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="h-[220px] w-[220px] shrink-0"
          role="img"
          aria-label={`${rsn}'s shape across ${axes.map((a) => a.label).join(', ')}`}
        >
          {RINGS.map((ring) => (
            <polygon
              key={ring}
              points={polygon(axes.map((_, i) => point(i, total, ring)))}
              className="fill-none stroke-card-border"
              strokeWidth={1}
            />
          ))}
          {outline.map((p, i) => (
            <line key={i} x1={CENTER} y1={CENTER} x2={p.x} y2={p.y} className="stroke-card-border" strokeWidth={1} />
          ))}
          <polygon points={polygon(filled)} className="fill-gold/25 stroke-gold" strokeWidth={2} />
          {filled.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={2.5} className="fill-gold" />
          ))}
          {axes.map((axis, i) => {
            const p = point(i, total, 118);
            return (
              <text
                key={axis.key}
                x={p.x}
                y={p.y}
                textAnchor={p.x > CENTER + 4 ? 'start' : p.x < CENTER - 4 ? 'end' : 'middle'}
                dominantBaseline="middle"
                className="fill-current text-[9px] text-text-muted"
              >
                {axis.label}
              </text>
            );
          })}
        </svg>

        <ul className="grid gap-1.5 text-sm min-w-[13rem] flex-1">
          {axes.map((axis) => (
            <li key={axis.key} className="flex items-center gap-2.5">
              <span className="w-20 shrink-0 text-text-muted text-xs">{axis.label}</span>
              <span className="h-2 flex-1 rounded-full bg-brown-dark overflow-hidden">
                <span className="block h-full rounded-full bg-gold/70" style={{ width: `${axis.pct ?? 0}%` }} />
              </span>
              <span className="w-24 shrink-0 text-right text-xs tabular-nums">
                {axis.pct == null ? (
                  <span className="text-text-muted">not tracked</span>
                ) : axis.standing ? (
                  <span className="text-text-muted">
                    #{axis.standing.position} of {axis.standing.of}
                  </span>
                ) : (
                  <span className="text-gold">top {Math.max(1, 100 - axis.pct)}%</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
