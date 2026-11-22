'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { HuntEndingFields } from '@/components/weekly/HuntFields';
import { clanFetch } from '@/lib/clanFetch';
import type { HuntConfirm, HuntEnding } from '@/lib/itemHunt';

/**
 * An item hunt's own settings: how it ends, and who confirms the drops that decide it. Changing
 * either on a running hunt is written to the audit log (lib/itemHuntDb updateHuntSettings).
 */
export default function HuntSettingsPanel({ competitionId, initial, finished, rowCount }: { competitionId: number; initial: { ends: HuntEnding; confirm: HuntConfirm }; finished: boolean; rowCount?: number }) {
  const router = useRouter();
  const [ends, setEnds] = useState<HuntEnding>(initial.ends);
  const [confirm, setConfirm] = useState<HuntConfirm>(initial.confirm);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const dirty = JSON.stringify(ends) !== JSON.stringify(initial.ends) || confirm !== initial.confirm;

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await clanFetch(`/api/admin/weekly/${competitionId}/hunt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'settings', ends, confirm }),
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
        The hunt
      </h2>
      {finished ? (
        <p className="text-sm text-text-muted">This hunt has finished, so how it ends can no longer change.</p>
      ) : (
        <>
          <HuntEndingFields ends={ends} confirm={confirm} onChange={(patch) => { if (patch.ends) setEnds(patch.ends); if (patch.confirm) setConfirm(patch.confirm); }} name="hunt-settings" rowCount={rowCount} />
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
