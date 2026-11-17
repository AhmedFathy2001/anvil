'use client';

import { useEffect, useRef, useState } from 'react';
import { useDialog } from '@/components/Confirm';
import { blackout, completedLines, lineProgress, nearlyLines, positionsOf } from '@/lib/bingoLines';

/**
 * What a classic board is actually played for.
 *
 * The grid scores by tiles, but everyone in the clan is chasing rows, columns and the blackout —
 * and the page never said a word about them. This computes each team's lines from the completions
 * the board already has, and leads with the sentence that changes what someone does next: which
 * team is one tile from a line, and which tile it is.
 *
 * Multi-claim matters here. A tile another team already finished is still open to you, so "Ember
 * has it" is never a reason a line is out of reach — the panel says so out loud, because the dots
 * on the grid make it look otherwise.
 */

export interface LineWatchTeam {
  id: number;
  name: string;
  color: string;
  /** Board positions this team has completed. */
  owned: Set<number>;
}

export function computeLineState(size: number, teams: LineWatchTeam[], existingPositions: Set<number>) {
  return teams.map((team) => {
    const progress = lineProgress(size, team.owned, existingPositions);
    return {
      team,
      complete: completedLines(progress),
      nearly: nearlyLines(progress),
      black: blackout(team.owned, existingPositions.size),
    };
  });
}

/** Teams whose finished-line count went up since `prev` (a team seen for the first time is not a rise). */
export function risenTeams(prev: Map<number, number>, now: { id: number; name: string; count: number }[]): { id: number; name: string; count: number }[] {
  return now.filter((t) => prev.has(t.id) && t.count > (prev.get(t.id) ?? 0));
}

export default function LineWatch({
  size,
  teams,
  existingPositions,
  labelFor,
  ownerNamesFor,
  lensTeamId,
}: {
  size: number;
  teams: LineWatchTeam[];
  existingPositions: Set<number>;
  /** Tile label for a board position. */
  labelFor: (position: number) => string;
  /** Which teams already have that tile — the "doesn't stop you" note. */
  ownerNamesFor: (position: number) => string[];
  lensTeamId: number | null;
}) {
  const state = computeLineState(size, teams, existingPositions);
  const dialog = useDialog();
  const seen = useRef<Map<number, number> | null>(null);
  const [pulse, setPulse] = useState<Set<number>>(new Set());
  const counts = state.map((s) => ({ id: s.team.id, name: s.team.name, count: s.complete.length }));
  const countKey = counts.map((c) => `${c.id}:${c.count}`).join(',');
  useEffect(() => {
    const now = countKey ? countKey.split(',').map((p) => p.split(':').map(Number)) : [];
    const prev = seen.current;
    seen.current = new Map(now.map(([id, n]) => [id, n]));
    if (!prev) return;
    const risen = risenTeams(prev, counts);
    if (risen.length === 0) return;
    for (const t of risen) dialog.notify(`${t.name} completed a line (${t.count} now)`);
    setPulse(new Set(risen.map((t) => t.id)));
    const timer = setTimeout(() => setPulse(new Set()), 4000);
    return () => clearTimeout(timer);
    // counts and dialog derive from countKey / are stable enough; the key is what changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countKey]);
  const shown = lensTeamId === null ? state : state.filter((s) => s.team.id === lensTeamId);
  const totalLines = state.reduce((n, s) => n + s.complete.length, 0);
  const chases = shown
    .flatMap((s) => s.nearly.map((n) => ({ ...n, team: s.team })))
    .sort((a, b) => a.missing.length - b.missing.length)
    .slice(0, 5);

  return (
    <div className="mt-5 rounded-xl border border-card-border bg-card-bg p-4">
      <h3 className="flex flex-wrap items-baseline gap-2 text-sm font-bold">
        Line watch
        <span className="text-xs font-normal text-text-muted">
          {totalLines === 0 ? 'no lines claimed yet' : `${totalLines} line${totalLines === 1 ? '' : 's'} claimed`}
        </span>
      </h3>

      {chases.length === 0 ? (
        <p className="mt-2.5 text-xs text-text-muted">
          {lensTeamId === null
            ? 'Nobody is within one tile of a line yet.'
            : 'This team is more than one tile from every line.'}
        </p>
      ) : (
        <div className="mt-2">
          {chases.map((c) => {
            const owners = c.missing.length === 1 ? ownerNamesFor(c.missing[0]) : [];
            return (
              <div
                key={`${c.team.id}-${c.line.key}`}
                className="flex items-start gap-2.5 border-t border-card-border/60 py-2 text-[12.5px] first:border-t-0"
              >
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: c.team.color }} />
                <span className="min-w-0 text-text-muted">
                  <b className="font-semibold text-foreground">{c.team.name}</b> need {c.line.name.toLowerCase()} — only{' '}
                  <b className="font-semibold text-foreground">{labelFor(c.missing[0])}</b> left
                  {owners.length > 0 && (
                    <span className="text-text-muted/80">
                      {' '}— {owners.join(' and ')} already {owners.length === 1 ? 'has' : 'have'} it, that doesn&apos;t stop them
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-card-border/60 pt-2.5 text-[11.5px] text-text-muted">
        {state.map((s) => (
          <span key={s.team.id} className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.team.color }} />
            <b className="font-semibold text-foreground">{s.team.name}</b>
            {s.complete.length > 0 && <span className={pulse.has(s.team.id) ? 'animate-pulse font-bold text-gold' : undefined}> {s.complete.length}🏁</span>} {s.black.pct}% of the board
          </span>
        ))}
      </div>
    </div>
  );
}

/** The board positions to outline for the lens team: the lines they've completed. */
export function completedLinePositions(size: number, owned: Set<number>, existingPositions: Set<number>): Set<number> {
  return positionsOf(completedLines(lineProgress(size, owned, existingPositions)));
}

/** The single tiles that would finish a line for the lens team. */
export function needyPositions(size: number, owned: Set<number>, existingPositions: Set<number>): Set<number> {
  const out = new Set<number>();
  for (const n of nearlyLines(lineProgress(size, owned, existingPositions))) out.add(n.missing[0]);
  return out;
}
