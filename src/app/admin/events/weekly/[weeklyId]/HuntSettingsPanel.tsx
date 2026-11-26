'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import NumberInput from '@/components/NumberInput';
import Radio from '@/components/Radio';
import Input from '@/components/Input';
import Select from '@/components/Select';
import { MAX_RUSH_ADJUST } from '@/lib/bossRushRules';
import ThingIcon from '@/components/ThingIcon';
import { HuntEndingFields, RushFields } from '@/components/weekly/HuntFields';
import type { RushRules } from '@/lib/bossRushRules';
import { clanFetch } from '@/lib/clanFetch';
import { MAX_ITEM_POINTS, type HuntConfirm, type HuntEnding } from '@/lib/itemHunt';
import { itemIconUrl } from '@/lib/tileIcons';

/** A running Boss Rush: its targets (fixed), its scoring, duplicates and each drop's points (editable). */
export interface RushSettings {
  rules: RushRules;
  repeat: 'every' | 'first';
  items: { id: number; name: string; points: number }[];
  /** For "Adjust points". */
  entrants: { id: number; rsn: string }[];
}

/**
 * An item hunt's own settings: how it ends, and who confirms the drops that decide it. Changing
 * either on a running hunt is written to the audit log (lib/itemHuntDb updateHuntSettings).
 */
/** Add points to one entrant, or take some off, with the reason (lib/itemHuntDb adjustRushPoints). */
function AdjustPoints({ competitionId, entrants }: { competitionId: number; entrants: { id: number; rsn: string }[] }) {
  const router = useRouter();
  const [who, setWho] = useState('');
  const [points, setPoints] = useState(10);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await clanFetch(`/api/admin/weekly/${competitionId}/hunt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'adjust', participantId: Number(who), points, note }),
      });
      const data = await res.json().catch(() => ({}));
      const name = entrants.find((e) => String(e.id) === who)?.rsn ?? 'them';
      setMessage(res.ok ? { ok: true, text: `${points > 0 ? 'Added' : 'Took off'} ${Math.abs(points)} for ${name}.` } : { ok: false, text: data.error || 'Could not save.' });
      if (res.ok) {
        setNote('');
        router.refresh();
      }
    } catch {
      setMessage({ ok: false, text: 'Could not save.' });
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-foreground/70">Adjust points</p>
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full sm:w-60">
          <Select value={who} onChange={setWho} ariaLabel="Player" placeholder="Pick a player" searchable options={entrants.map((e) => ({ value: String(e.id), label: e.rsn }))} />
        </div>
        <NumberInput value={points} onChange={setPoints} min={-MAX_RUSH_ADJUST} max={MAX_RUSH_ADJUST} fallback={10} className="w-24" aria-label="Points (below 0 takes off)" />
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why (for the audit log)" maxLength={200} className="min-h-11 min-w-0 flex-1 basis-48" aria-label="Why" />
        <button type="button" onClick={save} disabled={busy || !who || !points} className="min-h-11 rounded-lg border border-gold/40 px-4 text-sm font-semibold text-gold hover:bg-gold/10 disabled:opacity-50">
          {busy ? 'Saving…' : 'Apply'}
        </button>
      </div>
      {message && <p className={`mt-1.5 text-sm ${message.ok ? 'text-accent-green-light' : 'text-red-400'}`}>{message.text}</p>}
      <p className="mt-1.5 text-xs text-text-muted">Shown beside their score as &ldquo;by staff&rdquo; and written to the audit log. Below 0 takes points off.</p>
    </div>
  );
}

export default function HuntSettingsPanel({ competitionId, initial, finished, rowCount, rush }: { competitionId: number; initial: { ends: HuntEnding; confirm: HuntConfirm }; finished: boolean; rowCount?: number; rush?: RushSettings | null }) {
  const router = useRouter();
  const [ends, setEnds] = useState<HuntEnding>(initial.ends);
  const [confirm, setConfirm] = useState<HuntConfirm>(initial.confirm);
  const [rules, setRules] = useState<RushRules | null>(rush?.rules ?? null);
  const [points, setPoints] = useState<Record<number, number>>(() => Object.fromEntries((rush?.items ?? []).map((it) => [it.id, it.points])));
  const [repeat, setRepeat] = useState<'every' | 'first'>(rush?.repeat ?? 'every');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const rushDirty = !!rush && (JSON.stringify(rules) !== JSON.stringify(rush.rules) || repeat !== rush.repeat || rush.items.some((it) => points[it.id] !== it.points));
  const dirty = JSON.stringify(ends) !== JSON.stringify(initial.ends) || confirm !== initial.confirm || rushDirty;

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await clanFetch(`/api/admin/weekly/${competitionId}/hunt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'settings', ends, confirm, ...(rush ? { rush: rules, points, repeat } : {}) }),
      });
      const data = await res.json().catch(() => ({}));
      setMessage(res.ok ? { ok: true, text: 'Saved.' } : { ok: false, text: data.error || 'Could not save.' });
      if (res.ok) router.refresh();
    } catch {
      setMessage({ ok: false, text: 'Could not save.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mb-6 rounded-xl border border-card-border bg-card-bg p-5">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
        <span className="h-5 w-1 rounded-full bg-gold" />
        {rush ? 'The rush' : 'The hunt'}
      </h2>
      {finished ? (
        <p className="text-sm text-text-muted">This hunt has finished, so how it ends can no longer change.</p>
      ) : (
        <>
          {rush && rules && (
            <div className="mb-5 space-y-4">
              <RushFields targets={rush.rules.targets} rules={rules} onRules={(patch) => setRules({ ...rules, ...patch })} lockTargets />
              <div className="grid gap-2 sm:grid-cols-2">
                {([
                  ['every', 'A second drop of an item scores again'],
                  ['first', "Only each player's first one scores"],
                ] as const).map(([key, title]) => (
                  <label key={key} className={`flex cursor-pointer gap-2.5 rounded-lg border p-3 text-sm ${repeat === key ? 'border-gold/60 bg-gold/[0.06]' : 'border-card-border bg-brown-dark/30'}`}>
                    <Radio name="rush-repeat" checked={repeat === key} onChange={() => setRepeat(key)} />
                    <span className="text-sm font-medium">{title}</span>
                  </label>
                ))}
              </div>
              <AdjustPoints competitionId={competitionId} entrants={rush.entrants} />
              {rush.items.length > 0 && (
                <div>
                  <p className="mb-1.5 text-sm font-medium text-foreground/70">Drop points</p>
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {rush.items.map((it) => (
                      <li key={it.id} className="flex items-center gap-2.5 rounded-lg border border-card-border bg-brown-dark/30 p-2">
                        <ThingIcon src={itemIconUrl(it.id)} alt="" size={24} />
                        <span className="min-w-0 flex-1 truncate text-sm">{it.name}</span>
                        <NumberInput value={points[it.id] ?? 0} onChange={(v) => setPoints({ ...points, [it.id]: v })} min={0} max={MAX_ITEM_POINTS} fallback={0} className="w-20" aria-label={`Points for ${it.name}`} />
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1.5 text-xs text-text-muted">Every score is worked out again from these, drops already in included.</p>
                </div>
              )}
            </div>
          )}
          <HuntEndingFields ends={ends} confirm={confirm} onChange={(patch) => { if (patch.ends) setEnds(patch.ends); if (patch.confirm) setConfirm(patch.confirm); }} name="hunt-settings" rowCount={rowCount} dateOnly={!!rush} />
          <p className="mt-3 text-xs text-text-muted">
            Switching to automatic does not confirm anything that is already waiting: held reports stay with staff. Changes here are written to the audit log.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="button" onClick={save} disabled={busy || !dirty} className="min-h-11 rounded-lg bg-gold px-4 py-2 text-sm font-bold text-brown-dark hover:bg-gold-light disabled:opacity-50">
              {busy ? 'Saving…' : 'Save'}
            </button>
            {message && <span className={`text-sm ${message.ok ? 'text-accent-green-light' : 'text-red-400'}`}>{message.text}</span>}
          </div>
        </>
      )}
    </section>
  );
}
