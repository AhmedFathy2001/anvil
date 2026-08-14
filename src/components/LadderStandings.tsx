'use client';

import { useState } from 'react';
import { formatNumber } from '@/lib/utils';
import type { IndividualStanding } from '@/lib/memberBreakdown';

// The individual leaderboard for a 'ladder' event — every player ranked event-wide by points
// (a person's alts already rolled into one row upstream). Same rank/medal/name/value shape as the
// weekly SotW/BotW table (src/app/weekly/[id]/page.tsx), the surface this mirrors.
//
// `showTeam` labels each row with its team when the event runs real (multi-person) teams; on the
// default one-team-each ladder every team is a single person, so it's suppressed as noise.
//
// `monthly` is the same board windowed to the current UTC month. When present it adds a
// whole-run / This month toggle — the ladder runs forever while the monthly board resets each month.
//
// Which board opens first depends on how the ladder is set up. An OPEN-ENDED ladder (no end date)
// is a rolling monthly competition: the current month is the live race, and the running total is
// the historical view — so it opens on This month. A ladder with an end date is a bounded event
// whose whole run IS the competition, so that board leads and the label says so.
export default function LadderStandings({
  standings,
  monthly,
  showTeam = false,
  openEnded = false,
}: {
  standings: IndividualStanding[];
  monthly?: IndividualStanding[];
  showTeam?: boolean;
  /** Ladder with no end date — a rolling board that cycles monthly rather than a fixed run. */
  openEnded?: boolean;
}) {
  const hasMonthly = !!monthly;
  const [scope, setScope] = useState<'all' | 'month'>(openEnded && hasMonthly ? 'month' : 'all');
  const rows = scope === 'month' && monthly ? monthly : standings;

  return (
    <div>
      {hasMonthly && (
        <div className="inline-flex mb-4 rounded-lg border border-card-border overflow-hidden text-xs font-medium">
          {(['all', 'month'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setScope(s)}
              className={`px-3 py-1.5 transition-colors ${
                scope === s ? 'bg-gold text-brown-dark' : 'text-text-muted hover:text-foreground'
              }`}
            >
              {s === 'month' ? 'This month' : openEnded ? 'All-time' : 'Whole event'}
            </button>
          ))}
        </div>
      )}
      {rows.length === 0 ? (
        <div className="text-sm text-text-muted py-8 text-center border border-dashed border-card-border rounded-xl">
          {scope === 'month'
            ? 'No points this month yet — the monthly board fills as players complete tasks.'
            : 'No points yet — the leaderboard fills as players complete tasks.'}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-text-muted border-b border-card-border">
                <th className="py-2 pr-2 font-medium w-12">Rank</th>
                <th className="py-2 px-2 font-medium">Player</th>
                <th className="py-2 pl-2 font-medium text-right">Points</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((entry, i) => {
                const rank = i + 1;
                const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '';
                const top3 = rank <= 3;
                return (
                  <tr
                    key={entry.playerId}
                    className={`border-b border-card-border/60 ${top3 ? 'bg-gold/5' : ''} ${entry.frozenAt ? 'opacity-60' : ''}`}
                  >
                    <td className="py-2 pr-2 font-mono text-text-muted">{medal || `#${rank}`}</td>
                    <td className="py-2 px-2">
                      <span className={`font-medium ${top3 ? 'text-gold' : ''}`}>{entry.name}</span>
                      {showTeam && (
                        <span className="ml-2 inline-flex items-center gap-1 text-[11px] text-text-muted">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.teamColor }} />
                          {entry.teamName}
                        </span>
                      )}
                      {entry.frozenAt && (
                        <span className="ml-2 text-[10px] uppercase tracking-wide text-amber-300/80">subbed out</span>
                      )}
                      <span className="ml-2 text-xs text-text-muted">
                        · {entry.tasks} task{entry.tasks === 1 ? '' : 's'}
                      </span>
                    </td>
                    <td className="py-2 pl-2 text-right font-mono font-semibold text-accent-green-light">
                      {formatNumber(entry.points)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
