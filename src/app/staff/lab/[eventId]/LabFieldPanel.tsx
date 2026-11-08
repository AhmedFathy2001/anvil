'use client';

import { useState } from 'react';

import Checkbox from '@/components/Checkbox';
import NumberInput from '@/components/NumberInput';
import Select from '@/components/Select';
import { MAX_LAB_FIELD, MAX_LAB_TEAM_SIZE } from '@/lib/labPlan';

/**
 * The field (lib/labField): fill the session with test players, give them random progress so the
 * race, crowd and standings views have something to draw, and take that progress back. Simulated
 * credits only ever go to teams made entirely of test players; your own team is yours to play.
 */
export default function LabFieldPanel({
  solo,
  teams,
  testTeams,
  simulated,
  credits,
  busy,
  act,
}: {
  solo: boolean;
  teams: number;
  testTeams: number;
  simulated: number;
  credits: number;
  busy: boolean;
  act: (action: string, extra?: Record<string, unknown>) => Promise<void>;
}) {
  const [players, setPlayers] = useState(solo ? 50 : 30);
  const [teamSize, setTeamSize] = useState(3);
  const [soloField, setSoloField] = useState(solo);
  const [intensity, setIntensity] = useState('0.6');
  const btn = 'rounded-lg border border-card-border px-3 py-1.5 text-sm text-gray-200 hover:border-gold/60 disabled:opacity-50';

  return (
    <section className="rounded-xl border border-card-border bg-card-bg p-5">
      <h2 className="mb-1 flex items-center gap-2 font-semibold text-gold"><span className="h-5 w-1 bg-gold" />The field</h2>
      <p className="mb-3 text-xs text-text-muted">
        {teams} team{teams === 1 ? '' : 's'} on the board, {testTeams} of them test players only. {credits} credit
        {credits === 1 ? '' : 's'}, {simulated} simulated. Simulated rows are lab-only and tagged on the board below;
        Reset or Clear simulated removes them.
      </p>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="text-xs text-gray-300">
          Test players
          <NumberInput value={players} onChange={setPlayers} min={1} max={MAX_LAB_FIELD} fallback={10} className="mt-1 w-24" aria-label="Test players" />
        </label>
        {!soloField && (
          <label className="text-xs text-gray-300">
            Per team
            <NumberInput value={teamSize} onChange={setTeamSize} min={1} max={MAX_LAB_TEAM_SIZE} fallback={3} className="mt-1 w-20" aria-label="Players per team" />
          </label>
        )}
        <Checkbox checked={soloField} onChange={setSoloField} label="Each on their own" />
        <button type="button" className={btn} disabled={busy} onClick={() => void act('add-field', { players, teamSize, solo: soloField })}>
          {busy ? 'Working…' : 'Add test players'}
        </button>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-gray-300">
          How far along
          <Select
            value={intensity}
            onChange={setIntensity}
            options={[
              { value: '0.25', label: 'A little' },
              { value: '0.6', label: 'Mid-event' },
              { value: '1', label: 'Near the end' },
            ]}
            ariaLabel="How far along"
            className="mt-1 w-40"
          />
        </label>
        <button
          type="button"
          className="rounded-lg bg-gold px-3 py-1.5 text-sm font-semibold text-brown-dark disabled:opacity-50"
          disabled={busy || testTeams === 0}
          onClick={() => void act('simulate-field', { intensity: Number(intensity) })}
        >
          Simulate the field
        </button>
        <button type="button" className={btn} disabled={busy || simulated === 0} onClick={() => void act('clear-simulated')}>
          Clear simulated
        </button>
      </div>
    </section>
  );
}
