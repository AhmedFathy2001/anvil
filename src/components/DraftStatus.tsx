'use client';

interface Team {
  id: number;
  name: string;
  color: string;
}

interface Props {
  status: string;
  currentTeamId: number | null;
  round: number;
  pickInRound: number;
  currentPickNumber: number;
  totalPicked: number;
  poolRemaining: number;
  teams: Team[];
  teamOrder: number[];
}

export default function DraftStatus({
  status,
  currentTeamId,
  round,
  pickInRound,
  currentPickNumber,
  totalPicked,
  poolRemaining,
  teams,
  teamOrder,
}: Props) {
  const currentTeam = teams.find((t) => t.id === currentTeamId);

  return (
    <div className="border border-card-border rounded-xl p-4 bg-card-bg">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-gold">Draft Status</h3>
        <span
          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            status === 'active'
              ? 'bg-accent-green/20 text-accent-green-light'
              : status === 'paused'
              ? 'bg-gold/20 text-gold'
              : status === 'completed'
              ? 'bg-blue-500/20 text-blue-400'
              : 'bg-card-border text-text-muted'
          }`}
        >
          {status.toUpperCase()}
        </span>
      </div>

      {status === 'active' && currentTeam && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: currentTeam.color }}
            />
            <span className="font-semibold text-lg">{currentTeam.name}&apos;s pick</span>
          </div>
          <div className="text-sm text-text-muted">
            Round {round + 1}, Pick {pickInRound + 1} (Overall #{currentPickNumber + 1})
          </div>
        </div>
      )}

      {status === 'paused' && (
        <p className="text-gold text-sm">Draft is paused. Waiting for admin to resume.</p>
      )}

      {status === 'completed' && (
        <p className="text-text-muted text-sm">Draft complete! All picks are final.</p>
      )}

      <div className="flex gap-4 mt-3 text-sm text-text-muted">
        <span>{totalPicked} picked</span>
        <span>{poolRemaining} remaining</span>
      </div>

      {teamOrder.length > 0 && (
        <div className="mt-3 pt-3 border-t border-card-border">
          <p className="text-xs text-text-muted mb-1.5">Draft Order (Round 1)</p>
          <div className="flex flex-wrap gap-1.5">
            {teamOrder.map((tId, i) => {
              const team = teams.find((t) => t.id === tId);
              if (!team) return null;
              const isActive = tId === currentTeamId && status === 'active';
              return (
                <span
                  key={tId}
                  className={`text-xs px-2 py-0.5 rounded-full border ${
                    isActive
                      ? 'border-gold bg-gold/20 text-gold font-medium'
                      : 'border-card-border text-text-muted'
                  }`}
                >
                  {i + 1}. {team.name}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
