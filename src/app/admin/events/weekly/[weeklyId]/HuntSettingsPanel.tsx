'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import NumberInput from '@/components/NumberInput';
import ThingIcon from '@/components/ThingIcon';
import { HuntEndingFields, RushFields } from '@/components/weekly/HuntFields';
import type { RushRules } from '@/lib/bossRushRules';
import { clanFetch } from '@/lib/clanFetch';
import { MAX_ITEM_POINTS, type HuntConfirm, type HuntEnding } from '@/lib/itemHunt';
import { itemIconUrl } from '@/lib/tileIcons';

/** A running Boss Rush: its bosses (fixed), its scoring and each drop's points (both editable). */
export interface RushSettings {
  bosses: string[];
  rules: RushRules;
  items: { id: number; name: string; points: number }[];
}

/**
 * An item hunt's own settings: how it ends, and who confirms the drops that decide it. Changing
 * either on a running hunt is written to the audit log (lib/itemHuntDb updateHuntSettings).
 */
export default function HuntSettingsPanel({ competitionId, initial, finished, rowCount, rush }: { competitionId: number; initial: { ends: HuntEnding; confirm: HuntConfirm }; finished: boolean; rowCount?: number; rush?: RushSettings | null }) {
  const router = useRouter();
  const [ends, setEnds] = useState<HuntEnding>(initial.ends);
  const [confirm, setConfirm] = useState<HuntConfirm>(initial.confirm);
  const [rules, setRules] = useState<RushRules | null>(rush?.rules ?? null);
  const [points, setPoints] = useState<Record<number, number>>(() => Object.fromEntries((rush?.items ?? []).map((it) => [it.id, it.points])));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const rushDirty = !!rush && (JSON.stringify(rules) !== JSON.stringify(rush.rules) || rush.items.some((it) => points[it.id] !== it.points));
  const dirty = JSON.stringify(ends) !== JSON.stringify(initial.ends) || confirm !== initial.confirm || rushDirty;

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await clanFetch(`/api/admin/weekly/${competitionId}/hunt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'settings', ends, confirm, ...(rush ? { rush: rules, points } : {}) }),
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
              <RushFields bosses={rush.bosses} rules={rules} onRules={(patch) => setRules({ ...rules, ...patch })} lockBosses />
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
