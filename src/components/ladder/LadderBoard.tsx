'use client';

import { Delta } from './YouStrip';
import type { LadderScope } from '@/lib/ladderView';

/**
 * The ladder standings, in two pieces that share one scope.
 *
 * The top three get a podium — the crown, the streak and the movement are the story a ladder tells,
 * and three table rows can't tell it. Everyone else gets a dense table, because from 4th down what
 * you want is to find yourself and see who's next.
 *
 * The scopes are the same computation over different slices of time. The last-7-days board is the
 * one that keeps a mid-table player interested in a season they can't win outright, and which
 * scopes exist at all depends on the ladder's lifecycle (a one-shot run has no all-time), so the
 * server decides that and hands them over.
 */

const MEDALS = ['🥇', '🥈', '🥉'];

function Sparkline({ points, gold }: { points: number[]; gold: boolean }) {
  if (!points.length || points.every((p) => p === 0)) return null;
  const w = 72;
  const h = 20;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const span = Math.max(1, max - min);
  const coords = points.map((v, i) => `${(i / (points.length - 1)) * w},${h - ((v - min) / span) * h}`);
  const [lx, ly] = coords[coords.length - 1].split(',');
  const stroke = gold ? '#f0c940' : '#8a7e6c';
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible" aria-hidden>
      <polyline
        points={coords.join(' ')}
        fill="none"
        stroke={stroke}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.75}
      />
      <circle cx={lx} cy={ly} r={2.4} fill={stroke} />
    </svg>
  );
}

export function ScopeBar({
  scopes,
  value,
  onChange,
  note,
}: {
  scopes: LadderScope[];
  value: LadderScope['key'];
  onChange: (key: LadderScope['key']) => void;
  note: string;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
        <span className="h-5 w-1 rounded-full bg-gold" />
        Standings
      </h2>
      <span className="text-xs text-text-muted">{note}</span>
      <span className="ml-auto inline-flex overflow-hidden rounded-lg border border-card-border text-xs font-semibold">
        {scopes.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => onChange(s.key)}
            aria-pressed={s.key === value}
            className={`px-3 py-1.5 transition-colors ${
              s.key === value ? 'bg-gold text-brown-dark' : 'text-text-muted hover:text-foreground'
            }`}
          >
            {s.label}
          </button>
        ))}
      </span>
    </div>
  );
}

export function Podium({
  scope,
  streaks,
  sparks,
  mePlayerId,
  showTeam,
}: {
  scope: LadderScope;
  streaks: Record<number, number>;
  sparks: Record<number, number[]>;
  mePlayerId: number | null;
  showTeam: boolean;
}) {
  const podium = scope.rows.slice(0, 3);
  if (podium.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-card-border py-10 text-center text-sm text-text-muted">
        Nothing on this board yet — it fills as players claim tasks.
      </div>
    );
  }
  return (
    <div className="grid items-end gap-3 sm:grid-cols-3">
      {podium.map((r, i) => {
        const first = i === 0;
        const isMe = r.playerId === mePlayerId;
        return (
          <div
            key={r.playerId}
            className={`relative overflow-hidden rounded-xl border p-4 ${
              first
                ? 'border-gold/45 bg-card-bg bg-[radial-gradient(120%_100%_at_50%_0%,rgba(212,175,55,0.18),transparent_66%)] py-6'
                : 'border-card-border bg-card-bg'
            } ${isMe ? 'ring-1 ring-accent-green/40' : ''}`}
          >
            <span className="absolute right-3.5 top-3.5 text-xl leading-none" aria-hidden>
              {MEDALS[i]}
            </span>
            <div className={`font-mono text-xs font-bold tracking-widest ${first ? 'text-gold' : 'text-text-muted'}`}>
              {first ? 'LEADER' : `#${i + 1}`}
            </div>
            <div className={`mt-2 break-words font-extrabold leading-tight ${first ? 'text-xl text-gold-light sm:text-2xl' : 'text-lg'}`}>
              {r.name}
            </div>
            <div className="mt-2.5 flex items-baseline gap-2">
              <span
                className={`font-mono font-bold leading-none tabular-nums ${
                  first ? 'text-4xl text-gold-light' : i === 1 ? 'text-3xl text-[#cfd3d8]' : 'text-3xl text-[#c8916a]'
                }`}
              >
                {Math.round(r.points).toLocaleString()}
              </span>
              <span className="text-xs text-text-muted">pts</span>
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-text-muted">
              <span>
                {r.tasks} task{r.tasks === 1 ? '' : 's'}
              </span>
              <Delta value={scope.movement[r.playerId]} />
              {streaks[r.playerId] > 1 && <span title={`${streaks[r.playerId]}-day streak`}>🔥</span>}
              {showTeam && (
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: r.teamColor }} />
                  {r.teamName}
                </span>
              )}
              <span className="ml-auto">
                <Sparkline points={sparks[r.playerId] ?? []} gold={first} />
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function Chase({
  scope,
  streaks,
  mePlayerId,
  showTeam,
}: {
  scope: LadderScope;
  streaks: Record<number, number>;
  mePlayerId: number | null;
  showTeam: boolean;
}) {
  const chase = scope.rows.slice(3);
  return (
    <div>
      <h2 className="mb-4 flex flex-wrap items-center gap-2 text-lg font-bold text-foreground">
        <span className="h-5 w-1 rounded-full bg-gold" />
        The chase
        <span className="text-xs font-normal text-text-muted">
          {chase.length > 0 ? `ranks 4–${scope.rows.length}` : 'nobody else on the board yet'}
        </span>
      </h2>
      {chase.length === 0 ? (
        <div className="rounded-xl border border-dashed border-card-border px-4 py-8 text-center text-xs text-text-muted">
          The rest of the ladder shows up here as people start claiming.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-card-border">
          {chase.map((r, i) => {
            const isMe = r.playerId === mePlayerId;
            return (
              <div
                key={r.playerId}
                className={`grid grid-cols-[34px_minmax(0,1fr)_auto_auto] items-center gap-3 border-b border-card-border/60 px-3 py-2 last:border-b-0 ${
                  isMe
                    ? 'bg-gradient-to-r from-accent-green/20 to-card-bg shadow-[inset_3px_0_0_#34d058]'
                    : 'bg-card-bg'
                } ${r.frozenAt ? 'opacity-60' : ''}`}
              >
                <span className="font-mono text-xs text-text-muted">#{i + 4}</span>
                <span className="min-w-0 truncate text-sm">
                  <span className={isMe ? 'font-bold' : 'font-medium'}>{r.name}</span>
                  {streaks[r.playerId] > 1 && <span className="ml-1.5 text-xs">🔥</span>}
                  {showTeam && (
                    <span className="ml-2 inline-flex items-center gap-1 text-[11px] text-text-muted">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: r.teamColor }} />
                      {r.teamName}
                    </span>
                  )}
                  {r.frozenAt && <span className="ml-2 text-[10px] uppercase tracking-wide text-amber-300/80">subbed out</span>}
                  <span className="ml-2 text-xs text-text-muted">
                    {r.tasks} task{r.tasks === 1 ? '' : 's'}
                  </span>
                </span>
                <span className="text-right font-mono text-sm font-bold tabular-nums text-accent-green-light">
                  {Math.round(r.points).toLocaleString()}
                </span>
                <span className="w-8 text-right">
                  <Delta value={scope.movement[r.playerId]} />
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
