'use client';

import type { TeamMvp } from '@/lib/memberBreakdown';
import ClanLink from '@/components/ClanLink';

interface Team {
  id: number;
  name: string;
  color: string;
}

interface ScoreboardProps {
  teams: Team[];
  totalTiles: number;
  completionCounts: Map<number, number>;
  eventId: number;
  dropProgressByTeam?: Map<number, { inProgress: number; total: number }>;
  // When true the scores in `completionCounts`/`totalTiles` are point weights, not
  // raw tile counts — relabel the UI accordingly ("X / Y pts", "X pts remaining").
  pointsMode?: boolean;
  // Per-team top contributor, shown as a small line on each card.
  teamMvps?: Record<number, TeamMvp | null>;
}

const MEDALS = ['🥇', '🥈', '🥉'];

export default function Scoreboard({ teams, totalTiles, completionCounts, eventId, dropProgressByTeam, pointsMode, teamMvps }: ScoreboardProps) {
  const sortedTeams = [...teams].sort((a, b) => {
    const aCount = completionCounts.get(a.id) || 0;
    const bCount = completionCounts.get(b.id) || 0;
    return bCount - aCount;
  });

  return (
    <div className="space-y-2.5">
      {sortedTeams.map((team, index) => {
        const completed = completionCounts.get(team.id) || 0;
        const percentage = totalTiles > 0 ? (completed / totalTiles) * 100 : 0;
        const tilesLeft = totalTiles - completed;
        const isLeading = index === 0 && completed > 0;
        const dropInfo = dropProgressByTeam?.get(team.id);
        const mvp = teamMvps?.[team.id] ?? null;

        return (
          <ClanLink
            key={team.id}
            href={`/events/${eventId}/teams/${team.id}`}
            className="block border rounded-xl p-4 transition-all duration-200 hover:scale-[1.01] hover:shadow-lg"
            style={{
              borderColor: isLeading ? team.color + '60' : 'var(--card-border)',
              backgroundColor: isLeading ? team.color + '08' : 'var(--card-bg)',
              boxShadow: isLeading ? `0 0 20px ${team.color}15` : undefined,
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-lg w-7 text-center shrink-0">
                  {index < 3 && completed > 0 ? MEDALS[index] : (
                    <span className="text-text-muted text-sm font-mono">#{index + 1}</span>
                  )}
                </span>
                <div
                  className="w-3.5 h-3.5 rounded-full ring-2 ring-offset-1 ring-offset-background ring-current shrink-0"
                  style={{ backgroundColor: team.color, color: team.color }}
                />
                <span className="font-bold text-lg truncate">{team.name}</span>
              </div>
              <div className="text-right min-w-0">
                <div className="whitespace-nowrap">
                  <span className="text-xl font-bold" style={{ color: team.color }}>
                    {completed}
                  </span>
                  <span className="text-text-muted text-sm">/{totalTiles}{pointsMode ? ' pts' : ''}</span>
                </div>
                <p className="text-xs text-text-muted">
                  {tilesLeft} {pointsMode ? 'pts ' : ''}remaining
                  {dropInfo && dropInfo.inProgress > 0 && (
                    <span className="text-yellow-400">
                      {' · '}{dropInfo.inProgress} drop{dropInfo.inProgress !== 1 ? 's' : ''} in progress
                    </span>
                  )}
                </p>
              </div>
            </div>
            <div className="w-full bg-brown-dark rounded-full h-3 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{
                  width: `${percentage}%`,
                  background: `linear-gradient(90deg, ${team.color}cc, ${team.color})`,
                  boxShadow: percentage > 0 ? `0 0 8px ${team.color}60` : undefined,
                }}
              />
            </div>
            <div className="flex justify-between mt-1.5">
              <span className="text-[11px] text-text-muted">{Math.round(percentage)}% complete</span>
              <span className="text-[11px] text-text-muted">View board &rarr;</span>
            </div>
            {mvp && (
              <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-card-border/60 text-[11px] text-text-muted">
                <span aria-hidden>🏆</span>
                <span className="text-gold/90 font-medium truncate min-w-0">{mvp.name}</span>
                <span className="shrink-0 ml-auto">
                  {pointsMode ? `${mvp.points.toLocaleString()} pts` : `${mvp.tasks} task${mvp.tasks !== 1 ? 's' : ''}`}
                </span>
              </div>
            )}
          </ClanLink>
        );
      })}
      {teams.length === 0 && (
        <p className="text-text-muted text-center py-8">No teams yet.</p>
      )}
    </div>
  );
}
