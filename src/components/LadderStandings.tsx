import { formatNumber } from '@/lib/utils';
import type { IndividualStanding } from '@/lib/memberBreakdown';

// The individual leaderboard for a 'ladder' event — every player ranked event-wide by points
// (a person's alts already rolled into one row upstream). Same rank/medal/name/value shape as the
// weekly SotW/BotW table (src/app/weekly/[id]/page.tsx), the surface this mirrors.
//
// `showTeam` labels each row with its team when the event runs real (multi-person) teams; on the
// default one-team-each ladder every team is a single person, so it's suppressed as noise.
export default function LadderStandings({
  standings,
  showTeam = false,
}: {
  standings: IndividualStanding[];
  showTeam?: boolean;
}) {
  if (standings.length === 0) {
    return (
      <div className="text-sm text-text-muted py-8 text-center border border-dashed border-card-border rounded-xl">
        No points yet — the leaderboard fills as players complete tasks.
      </div>
    );
  }

  return (
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
          {standings.map((entry, i) => {
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
  );
}
