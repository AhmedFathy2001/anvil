'use client';

import { useState } from 'react';

import Checkbox from '@/components/Checkbox';
import MissionRewardEditor from '@/components/MissionRewardEditor';
import NumberInput from '@/components/NumberInput';
import Select from '@/components/Select';
import type { MissionRules } from '@/lib/eventRules';

export interface MissionTile {
  id: number;
  label: string;
  parentTileId: number | null;
  mission: boolean;
  revealedAt: string | null;
  closedAt: string | null;
  missionRules: MissionRules | null;
}

interface Policy {
  announceMode: string;
  intervalMinutes: number;
  order: string;
}

/**
 * Missions on a lab board (lib/labMissions): add one or mark any tile as one, set its placement
 * rules, and drop or expire it now. The drop and the close are the reveal engine's own, so the board,
 * plugin and standings show exactly what a real mission does.
 */
export default function LabMissionsPanel({
  tiles,
  policy,
  pointsMode,
  teamPlay,
  busy,
  act,
}: {
  tiles: MissionTile[];
  policy: Policy | null;
  pointsMode: boolean;
  teamPlay: boolean;
  busy: boolean;
  act: (action: string, extra?: Record<string, unknown>) => Promise<void>;
}) {
  const missions = tiles.filter((t) => t.mission);
  const plain = tiles.filter((t) => !t.mission && t.parentTileId == null);
  const [markPick, setMarkPick] = useState('');
  const [editing, setEditing] = useState<number | null>(null);
  const btn = 'rounded-lg border border-card-border px-2.5 py-1 text-xs text-gray-200 hover:border-gold/60 disabled:opacity-50';

  return (
    <section className="rounded-xl border border-card-border bg-card-bg p-5">
      <h2 className="mb-1 flex items-center gap-2 font-semibold text-gold"><span className="h-5 w-1 bg-gold" />Missions</h2>
      <p className="mb-3 text-xs text-text-muted">
        A mission is hidden until it drops. Announce one now, let it be claimed, then expire it — the drop, the
        placement ladder and the close are the real mission engine&rsquo;s.
      </p>

      <div className="mb-4 flex flex-wrap items-end gap-2">
        <label className="text-xs text-gray-300">
          Drops
          <Select
            value={policy?.announceMode === 'interval' ? 'interval' : 'manual'}
            disabled={busy}
            onChange={(v) => void act('mission-policy', { announceMode: v })}
            options={[
              { value: 'manual', label: 'By hand (buttons below)' },
              { value: 'interval', label: 'On an interval' },
            ]}
            ariaLabel="How missions drop"
            className="mt-1 w-52"
          />
        </label>
        {policy?.announceMode === 'interval' && <IntervalSave key={policy.intervalMinutes} policy={policy} busy={busy} act={act} />}
        <button type="button" className={btn} disabled={busy} onClick={() => void act('mission-add')}>+ Mission tile</button>
        {plain.length > 0 && (
          <>
            <Select
              value={markPick}
              onChange={setMarkPick}
              options={plain.map((t) => ({ value: String(t.id), label: t.label }))}
              placeholder="Make a tile a mission…"
              ariaLabel="Make a tile a mission"
              className="w-56"
            />
            <button
              type="button"
              className={btn}
              disabled={busy || !markPick}
              onClick={() => {
                void act('mission-mark', { tileId: Number(markPick), on: true });
                setMarkPick('');
              }}
            >
              Mark as mission
            </button>
          </>
        )}
        {missions.some((m) => !m.revealedAt) && (
          <button type="button" className={btn} disabled={busy} onClick={() => void act('mission-announce')}>Announce next (board order rule)</button>
        )}
      </div>

      {missions.length === 0 ? (
        <p className="text-sm text-text-muted">No missions on this board.</p>
      ) : (
        <ul className="space-y-2">
          {missions.map((m) => {
            const state = m.closedAt ? 'closed' : m.revealedAt ? 'live' : 'hidden';
            return (
              <li key={m.id} className="rounded-lg border border-card-border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-gray-100">{m.label}</span>
                  <span
                    className={`rounded px-2 py-0.5 text-xs ${state === 'live' ? 'bg-accent-green/15 text-accent-green-light' : state === 'closed' ? 'bg-brown-light text-text-muted' : 'bg-gold/15 text-gold'}`}
                  >
                    {state}
                  </span>
                  <span className="text-xs text-text-muted">{rulesLine(m.missionRules)}</span>
                  <span className="ml-auto flex flex-wrap gap-1.5">
                    {state === 'hidden' && (
                      <button type="button" className={btn} disabled={busy} onClick={() => void act('mission-announce', { tileId: m.id })}>Announce now</button>
                    )}
                    {state === 'live' && (
                      <button type="button" className={btn} disabled={busy} onClick={() => void act('mission-expire', { tileId: m.id })}>Expire now</button>
                    )}
                    {state === 'closed' && (
                      <button type="button" className={btn} disabled={busy} onClick={() => void act('mission-reset', { tileId: m.id, to: 'live' })}>Reopen</button>
                    )}
                    {state !== 'hidden' && (
                      <button type="button" className={btn} disabled={busy} onClick={() => void act('mission-reset', { tileId: m.id, to: 'hidden' })}>Hide again</button>
                    )}
                    <button type="button" className={btn} disabled={busy} onClick={() => setEditing(editing === m.id ? null : m.id)}>
                      {editing === m.id ? 'Close rules' : 'Rules'}
                    </button>
                    <button type="button" className={btn} disabled={busy} onClick={() => void act('mission-mark', { tileId: m.id, on: false })}>Not a mission</button>
                  </span>
                </div>
                {editing === m.id && (
                  <MissionRulesForm
                    key={m.id}
                    initial={m.missionRules}
                    pointsMode={pointsMode}
                    teamPlay={teamPlay}
                    busy={busy}
                    onSave={(rules) => act('mission-rules', { tileId: m.id, rules })}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** The interval field commits on its own button, so a half-typed number never re-times the board. */
function IntervalSave({ policy, busy, act }: { policy: Policy; busy: boolean; act: (action: string, extra?: Record<string, unknown>) => Promise<void> }) {
  const [minutes, setMinutes] = useState(policy.intervalMinutes);
  return (
    <span className="flex items-end gap-2">
      <label className="text-xs text-gray-300">
        Every (minutes)
        <NumberInput value={minutes} onChange={setMinutes} min={5} max={10080} fallback={15} className="mt-1 w-24" aria-label="Minutes between drops" />
      </label>
      <button
        type="button"
        className="rounded-lg border border-card-border px-2.5 py-1 text-xs text-gray-200 hover:border-gold/60 disabled:opacity-50"
        disabled={busy || minutes === policy.intervalMinutes}
        onClick={() => void act('mission-policy', { announceMode: 'interval', intervalMinutes: minutes })}
      >
        Set interval
      </button>
    </span>
  );
}

function rulesLine(r: MissionRules | null): string {
  if (!r) return 'flat: tile value';
  const bits: string[] = [];
  const cap = r.reward?.maxClaims ?? (r.lockout ? 1 : null);
  bits.push(cap == null ? 'unlimited claims' : `${cap} claim${cap === 1 ? '' : 's'}`);
  if (r.reward?.places.length) bits.push(`${r.reward.places.length} paid place${r.reward.places.length === 1 ? '' : 's'}`);
  if (r.firstBonus) bits.push(`+${r.firstBonus} first`);
  if (r.expiryHours != null) bits.push(`expires ${r.expiryHours}h`);
  return bits.join(' · ');
}

/** Placement rules for one mission: the same MissionRules the tile editor writes. */
function MissionRulesForm({
  initial,
  pointsMode,
  teamPlay,
  busy,
  onSave,
}: {
  initial: MissionRules | null;
  pointsMode: boolean;
  teamPlay: boolean;
  busy: boolean;
  onSave: (rules: Partial<MissionRules>) => Promise<void>;
}) {
  const [lockout, setLockout] = useState(initial?.lockout ?? false);
  const [firstBonus, setFirstBonus] = useState(initial?.firstBonus ?? 0);
  const [expires, setExpires] = useState(initial?.expiryHours != null);
  const [expiryHours, setExpiryHours] = useState(initial?.expiryHours ?? 1);
  const [reward, setReward] = useState(initial?.reward ?? null);

  return (
    <div className="mt-3 space-y-3 border-t border-card-border pt-3">
      <div className="flex flex-wrap items-end gap-4">
        <Checkbox checked={lockout} onChange={setLockout} label="First claim closes it" />
        {pointsMode && (
          <label className="text-xs text-gray-300">
            First-clear bonus
            <NumberInput value={firstBonus} onChange={setFirstBonus} min={0} max={100000} fallback={0} className="mt-1 w-28" aria-label="First-clear bonus" />
          </label>
        )}
        <Checkbox checked={expires} onChange={setExpires} label="Expires after" />
        {expires && (
          <label className="text-xs text-gray-300">
            Hours
            <NumberInput value={expiryHours} onChange={setExpiryHours} min={1} max={8760} fallback={1} className="mt-1 w-24" aria-label="Expiry hours" />
          </label>
        )}
      </div>
      <MissionRewardEditor value={reward} onChange={setReward} pointsMode={pointsMode} teamPlay={teamPlay} />
      <button
        type="button"
        disabled={busy}
        onClick={() =>
          void onSave({
            ...(initial ?? {}),
            lockout,
            firstBonus,
            expiryHours: expires ? expiryHours : null,
            reward,
          })
        }
        className="rounded-lg bg-gold px-3 py-1.5 text-sm font-semibold text-brown-dark disabled:opacity-50"
      >
        Save rules
      </button>
    </div>
  );
}
