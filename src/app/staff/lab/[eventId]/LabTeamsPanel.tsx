'use client';

import type { LabTeamsView } from '@/lib/labTeams';
import Select from '@/components/Select';

/**
 * Teams on a lab board: add sides filled with test users, move anyone between teams (or off every
 * team), and set your own role on a team. The plugin follows whichever team your character is on.
 */
export default function LabTeamsPanel({
  teams,
  busy,
  act,
}: {
  teams: LabTeamsView;
  busy: boolean;
  act: (action: string, extra?: Record<string, unknown>) => Promise<void>;
}) {
  const btn = 'rounded-lg border border-card-border px-2.5 py-1 text-xs text-gray-200 hover:border-gold/60 disabled:opacity-50';
  // Roles are one at a time per board, so "member" is lit only where your character plays and only
  // while you are no team's captain or staff.
  const anyRole = teams.teams.some((t) => t.youCaptain || t.youStaff);
  const options = [{ id: null as number | null, name: 'No team' }, ...teams.teams.map((t) => ({ id: t.id as number | null, name: t.name }))];
  const mover = (participantId: number, current: number | null) => (
    <Select
      value={current == null ? '' : String(current)}
      disabled={busy}
      onChange={(v) => void act('move', { participantId, teamId: v === '' ? null : Number(v) })}
      options={options.map((o) => ({ value: o.id == null ? '' : String(o.id), label: o.name }))}
      ariaLabel="Move to team"
      className="w-36"
    />
  );

  return (
    <section>
      <h2 className="mb-1 flex items-center gap-2 font-semibold text-gold"><span className="h-5 w-1 bg-gold" />Teams</h2>
      <p className="mb-3 text-xs text-text-muted">
        Move your character to any team and the plugin tracks that team (next config poll). Your role buttons make you
        that team&rsquo;s captain, team staff, or a plain member. Test users (Lab~…) fill the other sides.
      </p>
      <div className="mb-3 flex flex-wrap gap-2">
        <button type="button" className={btn} disabled={busy} onClick={() => void act('add-team', { players: 3 })}>+ Team with 3 test players</button>
        <button type="button" className={btn} disabled={busy} onClick={() => void act('add-team', { players: 0 })}>+ Empty team</button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {teams.teams.map((t) => (
          <div key={t.id} className="rounded-lg border border-card-border bg-card-bg p-3">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-sm" style={{ background: t.color }} />
              <span className="font-semibold text-gray-100">{t.name}</span>
              <span className="text-xs text-text-muted">
                {t.captain ? `captain ${t.captain}` : 'no captain'}
                {t.staff.length ? ` · staff ${t.staff.join(', ')}` : ''}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="text-xs text-text-muted">You:</span>
              {(['captain', 'staff', 'member'] as const).map((role) => {
                const on = role === 'captain' ? t.youCaptain : role === 'staff' ? t.youStaff : !anyRole && t.members.some((m) => !m.test);
                return (
                  <button
                    key={role}
                    type="button"
                    disabled={busy}
                    onClick={() => void act('team-role', { teamId: t.id, role })}
                    className={`${btn} ${on ? 'border-gold/60 text-gold' : ''}`}
                  >
                    {role === 'staff' ? 'Team staff' : role[0].toUpperCase() + role.slice(1)}
                  </button>
                );
              })}
            </div>
            <ul className="mt-2 space-y-1 text-sm">
              {t.members.length === 0 && <li className="text-xs text-text-muted">Nobody on this team.</li>}
              {t.members.map((m) => (
                <li key={m.participantId} className="flex items-center justify-between gap-2">
                  <span className={m.test ? 'text-text-muted' : 'text-gray-100'}>{m.name}{!m.test && ' (you)'}</span>
                  {mover(m.participantId, t.id)}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {teams.unplaced.length > 0 && (
        <div className="mt-3 rounded-lg border border-dashed border-card-border p-3">
          <p className="mb-1 text-xs text-text-muted">On no team (in the event, playing for nobody):</p>
          <ul className="space-y-1 text-sm">
            {teams.unplaced.map((m) => (
              <li key={m.participantId} className="flex items-center justify-between gap-2">
                <span className={m.test ? 'text-text-muted' : 'text-gray-100'}>{m.name}</span>
                {mover(m.participantId, null)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
