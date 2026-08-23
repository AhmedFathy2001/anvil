'use client';

import type { TeamMvp } from '@/lib/memberBreakdown';
import ClanLink from '@/components/ClanLink';
import type { TeamScore } from '@/lib/boardScoring';

interface Team {
  id: number;
  name: string;
  color: string;
}

interface ScoreboardProps {
  teams: Team[];
  /** Per-team scores from lib/boardScoring — the one place any surface computes these. */
  scores: Map<number, TeamScore>;
  eventId: number;
  dropProgressByTeam?: Map<number, { inProgress: number; total: number }>;
  // When true scores are point weights, not raw tile counts — relabel the UI accordingly
  // ("X / Y pts", "X pts remaining").
  pointsMode?: boolean;
  // Per-team top contributor, shown as a small line on each card.
  teamMvps?: Record<number, TeamMvp | null>;
}

const ZERO: TeamScore = { teamId: 0, boardScore: 0, bonusScore: 0, score: 0, total: 0, unit: 'tiles', pct: 0 };

const MEDALS = ['🥇', '🥈', '🥉'];

export default function Scoreboard({ teams, scores, eventId, dropProgressByTeam, pointsMode, teamMvps }: ScoreboardProps) {
  const scoreOf = (teamId: number) => scores.get(teamId) ?? ZERO;
  // Rank on total earned, mission bonus included — it's points the team actually holds.
  const sortedTeams = [...teams].sort((a, b) => scoreOf(b.id).score - scoreOf(a.id).score);

  return (
    <div className="space-y-2.5">
      {sortedTeams.map((team, index) => {
        const score = scoreOf(team.id);
        const completed = score.score;
        const percentage = score.pct;
        // What's LEFT is board work, so it counts down the board half. A mission bonus is points in
        // hand, not board progress — subtracting it here would advertise a shorter board than exists.
        const tilesLeft = Math.max(0, score.total - score.boardScore);
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
                  <span className="text-text-muted text-sm">/{score.total}{pointsMode ? ' pts' : ''}</span>
                  {/* Missions are bonus: they're in the big number but not in the total, which reads
                      as an error unless the extra is named. Shown only when there is one. */}
                  {score.bonusScore > 0 && (
                    <span className="ml-1.5 text-[11px] rounded px-1.5 py-0.5 bg-purple-500/20 text-purple-200 border border-purple-400/30 align-middle">
                      +{score.bonusScore} bonus
                    </span>
                  )}
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
