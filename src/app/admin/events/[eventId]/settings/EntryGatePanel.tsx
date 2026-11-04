'use client';

import { useEffect, useState } from 'react';

import EntryGatePicker from '@/components/EntryGatePicker';
import { clanFetch } from '@/lib/clanFetch';
import type { EntryGates, GateOptions } from '@/lib/entryGates';

/** A creator-space event's "Who can join?" (lib/entryGates), saved on its own. */
export default function EntryGatePanel({ eventId }: { eventId: number }) {
  const [options, setOptions] = useState<GateOptions | null>(null);
  const [gates, setGates] = useState<EntryGates | null>(null);
  const [saved, setSaved] = useState<string>('null');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let alive = true;
    clanFetch(`/api/events/${eventId}/gate`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { gates: EntryGates | null; options: GateOptions } | null) => {
        if (!alive || !d) return;
        setOptions(d.options);
        setGates(d.gates);
        setSaved(JSON.stringify(d.gates));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [eventId]);

  if (!options) return null;
  const dirty = JSON.stringify(gates) !== saved;

  async function save() {
    setBusy(true);
    setNote(null);
    try {
      const res = await clanFetch(`/api/events/${eventId}/gate`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gates }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error ?? 'Could not save');
      setGates(d.gates ?? null);
      setSaved(JSON.stringify(d.gates ?? null));
      setNote({ ok: true, text: 'Saved.' });
    } catch (e) {
      setNote({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mb-6 rounded-2xl border border-card-border bg-card-bg">
      <div className="flex items-center gap-2.5 border-b border-card-border px-5 py-3.5">
        <span className="molten h-5 w-1 shrink-0 rounded-sm" />
        <h2 className="text-[15px] font-semibold">Who can join?</h2>
      </div>
      <div className="px-5 py-4">
        <EntryGatePicker value={gates} onChange={setGates} options={options} />
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={busy || !dirty}
            className="rounded-lg bg-gold px-4 py-1.5 text-[13px] font-semibold text-brown-dark transition-colors hover:bg-gold-light disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
          {note && <span className={`text-[12.5px] ${note.ok ? 'text-accent-green-light' : 'text-accent-red'}`}>{note.text}</span>}
        </div>
      </div>
    </section>
  );
}
