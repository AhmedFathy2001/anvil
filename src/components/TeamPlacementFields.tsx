'use client';

import Select from '@/components/Select';
import NumberInput from '@/components/NumberInput';
import { DEFAULT_AUTO_TEAM_COUNT, MAX_AUTO_TEAMS, MIN_AUTO_TEAMS, PLACEMENT_META, TEAM_PLACEMENTS, type TeamPlacement } from '@/lib/teamPlacement';

/**
 * The Team placement control (where each new sign-up lands, plus the team count / team size limit
 * that goes with it). Controlled and save-less: the Sign-ups settings card and the Teams page both
 * render it, each with its own Save, so a host can set teams up in one place.
 */
export default function TeamPlacementFields({
  placement,
  onPlacementChange,
  teamCount,
  onTeamCountChange,
  teamCap,
  onTeamCapChange,
}: {
  placement: TeamPlacement;
  onPlacementChange: (p: TeamPlacement) => void;
  teamCount: number;
  onTeamCountChange: (n: number) => void;
  teamCap: number;
  onTeamCapChange: (n: number) => void;
}) {
  return (
    <div className="rounded-lg border border-card-border bg-brown-dark/40 px-4 py-3 space-y-2">
      <div>
        <span className="text-xs text-text-muted">Team placement</span>
        <div className="mt-1 max-w-xs">
          <Select
            value={placement}
            onChange={(v) => onPlacementChange(v as TeamPlacement)}
            ariaLabel="Team placement"
            options={TEAM_PLACEMENTS.map((p) => ({ value: p, label: `${PLACEMENT_META[p].label}: ${PLACEMENT_META[p].short.toLowerCase()}` }))}
          />
        </div>
      </div>
      <p className="text-xs text-text-muted">
        {PLACEMENT_META[placement].help} Changing this never moves anyone already on a team, and a team&rsquo;s invite link
        always puts people on that team.
      </p>
      {placement === 'auto' && (
        <label className="flex items-center gap-2 text-sm">
          <span className="text-text-muted">Number of teams</span>
          <NumberInput
            value={teamCount}
            onChange={onTeamCountChange}
            min={MIN_AUTO_TEAMS}
            max={MAX_AUTO_TEAMS}
            fallback={DEFAULT_AUTO_TEAM_COUNT}
            className="w-24 bg-brown-light border border-card-border rounded-lg px-3 py-1.5 text-foreground focus:outline-none focus:border-gold"
          />
        </label>
      )}
      {placement === 'pick' && (
        <label className="flex items-center gap-2 text-sm">
          <span className="text-text-muted">Most players per team</span>
          <NumberInput
            value={teamCap}
            onChange={onTeamCapChange}
            min={0}
            max={1000}
            fallback={0}
            className="w-24 bg-brown-light border border-card-border rounded-lg px-3 py-1.5 text-foreground focus:outline-none focus:border-gold"
          />
          <span className="text-xs text-text-muted">0 = no limit</span>
        </label>
      )}
    </div>
  );
}
