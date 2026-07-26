'use client';

interface Player {
  id: number;
  name: string;
  teamId: number | null;
  pickNumber: number | null;
  ownerUserId?: number | null; // multi-account: a person's accounts share this (for per-person headcount)
}

interface Team {
  id: number;
  name: string;
  color: string;
}

interface PlayerGains {
  id: number;
  name: string;
  teamId: number | null;
  gains: Record<string, number>;
  error?: string;
}

interface TileGoalInfo {
  statKey: string;
  statType: string;
  goal: number | null;
  trackingMode: string;
  label: string;
}

interface Props {
  players: Player[];
  teams: Team[];
  teamOrder: number[];
  onPlayerClick?: (rsn: string) => void;
  gainsData?: PlayerGains[];
  tileGoals?: TileGoalInfo[];
  accountSlotMode?: string; // 'per-person' counts a person's accounts as one toward the headcount
}

// How many "slots" a roster fills: distinct people in per-person mode, else raw account rows.
function rosterSlots(roster: { id: number; ownerUserId?: number | null }[], perPerson: boolean): number {
  if (!perPerson) return roster.length;
  return new Set(roster.map((p) => (p.ownerUserId != null ? `u${p.ownerUserId}` : `p${p.id}`))).size;
}

function formatCompact(value: number, type: string): string {
  if (type === 'skill') {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m xp`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k xp`;
    return `${value} xp`;
  }
  return `${value.toLocaleString()} kc`;
}

export default function DraftRosters({ players, teams, teamOrder, onPlayerClick, gainsData, tileGoals, accountSlotMode }: Props) {
  const perPerson = accountSlotMode === 'per-person';
  const pickedPlayers = players
    .filter((p) => p.teamId !== null)
    .sort((a, b) => (a.pickNumber ?? 0) - (b.pickNumber ?? 0));

  const displayOrder = teamOrder.length > 0 ? teamOrder : teams.map((t) => t.id);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {displayOrder.map((teamId) => {
        const team = teams.find((t) => t.id === teamId);
        if (!team) return null;
        const roster = pickedPlayers.filter((p) => p.teamId === teamId);
        return (
          <div
            key={teamId}
            className="border border-card-border rounded-xl p-3 bg-card-bg"
          >
            <div className="flex items-center gap-2 mb-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: team.color }}
              />
              <span className="font-semibold text-sm">{team.name}</span>
              <span className="text-xs text-text-muted ml-auto">
                {perPerson && rosterSlots(roster, true) !== roster.length
                  ? `${rosterSlots(roster, true)} people · ${roster.length} accts`
                  : `${roster.length} players`}
              </span>
            </div>
            {roster.length > 0 ? (
              <div className="space-y-1">
                {roster.map((p) => {
                  const pg = gainsData?.find((g) => g.id === p.id);
                  return (
                    <div
                      key={p.id}
                      className="text-sm text-text-muted"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono w-5 text-right opacity-50">
                          #{(p.pickNumber ?? 0) + 1}
                        </span>
                        {onPlayerClick ? (
                          <button
                            onClick={() => onPlayerClick(p.name)}
                            className="text-gold hover:text-gold-light transition-colors underline decoration-gold/30 underline-offset-2"
                          >
                            {p.name}
                          </button>
                        ) : (
                          <span className="text-foreground">{p.name}</span>
                        )}
                      </div>
                      {pg && tileGoals && tileGoals.length > 0 && (
                        <div className="ml-7 flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                          {tileGoals.map((tg) => {
                            const gain = pg.gains[tg.statKey] ?? 0;
                            if (gain === 0 && !pg.error) return null;
                            return (
                              <span
                                key={tg.statKey}
                                className="text-[10px] font-mono text-accent-green-light"
                                title={tg.label}
                              >
                                +{formatCompact(gain, tg.statType)}
                                {tg.goal && (
                                  <span className="text-text-muted">
                                    /{tg.statType === 'skill'
                                      ? (tg.goal >= 1_000_000 ? `${(tg.goal / 1_000_000).toFixed(1)}m` : tg.goal >= 1_000 ? `${(tg.goal / 1_000).toFixed(0)}k` : tg.goal)
                                      : tg.goal}
                                  </span>
                                )}
                              </span>
                            );
                          })}
                          {pg.error && (
                            <span className="text-[10px] text-red-400">{pg.error}</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-text-muted">No players drafted yet</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
