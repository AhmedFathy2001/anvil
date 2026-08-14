'use client';

import { useEffect, useState } from 'react';

/**
 * A tile race is about position, and position is only half the story — the other half is pace.
 *
 * Two teams three tiles apart is a rout if the one in front is also faster and a photo finish if it
 * isn't, and the board couldn't say which. Pace comes straight from the completions the race
 * already stores: how many tiles a team has cleared, over how long, gives tiles/day, which gives a
 * projected finish and the answer to "are they catching up".
 */

export interface RaceTeam {
  id: number;
  name: string;
  color: string;
  /** Furthest contiguous tile reached (1-based); 0 = still on the start line. */
  reached: number;
  /** When they cleared their first and latest tile — the window their pace is measured over. */
  firstAt: string | null;
  lastAt: string | null;
}

const DAY_MS = 86_400_000;

/** Tiles per day, from the team's own first clear to their latest. Null until there's a window. */
export function paceOf(team: RaceTeam, now = Date.now()): number | null {
  if (team.reached <= 0 || !team.firstAt) return null;
  const start = Date.parse(team.firstAt);
  if (!Number.isFinite(start)) return null;
  const elapsed = Math.max(now - start, 60 * 60_000); // an hour's floor, so tile one isn't infinite pace
  return (team.reached / elapsed) * DAY_MS;
}

/** When they'd finish at that pace. Null when they've finished, or aren't moving. */
export function finishEta(team: RaceTeam, total: number, now = Date.now()): number | null {
  const pace = paceOf(team, now);
  if (pace == null || pace <= 0 || team.reached >= total) return null;
  return now + ((total - team.reached) / pace) * DAY_MS;
}

function fmtEta(ms: number, now: number): string {
  const d = new Date(ms);
  const days = Math.round((ms - now) / DAY_MS);
  if (days > 21) return 'weeks away';
  return d.toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function RacePace({
  teams,
  totalTiles,
  nextTileLabelFor,
}: {
  teams: RaceTeam[];
  totalTiles: number;
  /** The tile a team is chasing right now (the one after their frontier). */
  nextTileLabelFor: (team: RaceTeam) => string | null;
}) {
  // Null until mounted: pace is a function of "now", and rendering it on the server would hydrate
  // to a different number a second later.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const sorted = [...teams].sort((a, b) => b.reached - a.reached);
  const [leader, second] = sorted;
  if (!leader) return null;

  const leaderPace = now === null ? null : paceOf(leader, now);
  const secondPace = second && now !== null ? paceOf(second, now) : null;
  const gap = second ? leader.reached - second.reached : 0;
  // The chaser only catches up if they're genuinely quicker; the board should say which it is.
  const closing = leaderPace != null && secondPace != null && secondPace > leaderPace;

  return (
    <div className="mt-5">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
        <span className="h-4 w-1 rounded-full bg-gold" />
        Pace
        <span className="text-xs font-normal text-text-muted">measured from each team&apos;s own first clear</span>
      </h3>

      <div className="grid gap-2.5 sm:grid-cols-2">
        {sorted.map((t) => {
          const pace = now === null ? null : paceOf(t, now);
          const eta = now === null ? null : finishEta(t, totalTiles, now);
          const next = nextTileLabelFor(t);
          return (
            <div key={t.id} className="rounded-xl border border-card-border bg-card-bg p-3.5">
              <div className="flex items-center gap-2 text-sm font-bold">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: t.color }} />
                <span className="truncate">{t.name}</span>
                <span className="ml-auto font-mono text-xs text-text-muted">
                  tile {t.reached} / {totalTiles}
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-brown-dark">
                <div className="h-full rounded-full" style={{ width: `${(t.reached / totalTiles) * 100}%`, backgroundColor: t.color }} />
              </div>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-text-muted">
                <span>
                  pace <b className="font-semibold text-foreground">{pace != null ? `${pace.toFixed(1)} tiles/day` : '—'}</b>
                </span>
                <span>
                  {t.reached >= totalTiles ? (
                    <b className="font-semibold text-gold">🏁 finished</b>
                  ) : eta != null ? (
                    <>
                      finishes <b className="font-semibold text-foreground">{fmtEta(eta, now as number)}</b>
                    </>
                  ) : (
                    'not moving yet'
                  )}
                </span>
              </div>
              {next && t.reached < totalTiles && (
                <div className="mt-1.5 truncate text-[11.5px] text-text-muted">
                  now chasing <b className="font-semibold text-foreground">{next}</b>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {second && (
        <div className="mt-3 rounded-xl border border-card-border bg-card-bg px-4 py-3 text-[13px] text-text-muted">
          {gap === 0 ? (
            <>
              <b className="font-semibold text-foreground">{leader.name}</b> and{' '}
              <b className="font-semibold text-foreground">{second.name}</b> are level with{' '}
              {totalTiles - leader.reached} to go.
            </>
          ) : (
            <>
              <b className="font-semibold text-foreground">{leader.name}</b> leads by{' '}
              <b className="font-semibold text-foreground">{gap} tile{gap === 1 ? '' : 's'}</b> with{' '}
              {totalTiles - leader.reached} to go
              {closing ? (
                <>
                  {' '}— but <b className="font-semibold text-accent-green-light">{second.name} is clearing them faster</b>.
                </>
              ) : (
                <> and is the quicker of the two.</>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
