'use client';

import ChipsInput from '@/components/ChipsInput';
import Checkbox from '@/components/Checkbox';
import Select from '@/components/Select';
import type { CompetitionMode } from '@/lib/competitionTeams';

export interface WeeklyModeValue {
  mode: CompetitionMode;
  /** Teams mode: team names to create. */
  teams: string[];
  /** Teams mode: drop late joiners into the smallest team. */
  teamLateJoin: boolean;
  /** Clans mode: clan addresses (slugs) to invite. */
  clans: string[];
}

export const DEFAULT_WEEKLY_MODE: WeeklyModeValue = { mode: 'solo', teams: ['Team 1', 'Team 2'], teamLateJoin: true, clans: [] };

const MODE_OPTIONS = [
  { value: 'solo', label: 'Solo — everyone for themselves' },
  { value: 'teams', label: 'Teams — split the clan, team totals win' },
  { value: 'clans', label: 'Clan vs clan — clan totals win' },
];

/**
 * The competition format on the weekly create form (lib/competitionTeams). Teams are created with
 * the competition and everyone is split evenly by current level/KC; clans are invited by address and
 * each one's owner/admin accepts from their own admin.
 */
export default function WeeklyModeFields({ value, onChange }: { value: WeeklyModeValue; onChange: (v: WeeklyModeValue) => void }) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-foreground/70 mb-1.5">Format</label>
        <Select
          value={value.mode}
          onChange={(v) => onChange({ ...value, mode: (v as CompetitionMode) || 'solo' })}
          ariaLabel="Competition format"
          options={MODE_OPTIONS}
        />
      </div>

      {value.mode === 'teams' && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-foreground/70">Teams</label>
          <ChipsInput
            value={value.teams}
            onChange={(teams) => onChange({ ...value, teams: teams.slice(0, 16) })}
            placeholder="Add a team name and press Enter"
            ariaLabel="Team names"
          />
          <p className="text-xs text-text-muted">
            Everyone entered is split across these teams, balanced by their current level/KC. You can move people and
            re-balance from the competition&rsquo;s Teams page.
          </p>
          <Checkbox
            checked={value.teamLateJoin}
            onChange={(teamLateJoin) => onChange({ ...value, teamLateJoin })}
            label="Late joiners go into the smallest team"
            className="text-sm text-foreground/80"
          />
        </div>
      )}

      {value.mode === 'clans' && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-foreground/70">Invite clans</label>
          <ChipsInput
            value={value.clans}
            onChange={(clans) => onChange({ ...value, clans: clans.map((c) => c.trim().toLowerCase()).slice(0, 20) })}
            placeholder="Clan address, e.g. theafkspot"
            ariaLabel="Clans to invite"
            maxTagLength={64}
          />
          <p className="text-xs text-text-muted">
            The address is the part after /c/ in their link. An owner or admin of each clan accepts from their own admin;
            their whole roster races for their clan. You can invite more later.
          </p>
        </div>
      )}
    </div>
  );
}
