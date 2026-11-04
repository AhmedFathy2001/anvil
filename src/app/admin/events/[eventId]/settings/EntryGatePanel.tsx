'use client';

import SettingsCard from './SettingsCard';
import { useSaveBar } from './SaveBar';
import { useEffect, useState } from 'react';

import EntryGatePicker from '@/components/EntryGatePicker';
import { clanFetch } from '@/lib/clanFetch';
import type { EntryGates, GateOptions } from '@/lib/entryGates';
import Radio from '@/components/Radio';

/**
 * An event's "Who can join?" (lib/entryGates), saved on its own. On a creator space: who among the
 * viewers. On a clan with Streaming on, one choice comes first — Members only (the default, how every
 * clan event works) or viewers too — and viewers who join play this event only.
 */
export default function EntryGatePanel({ eventId }: { eventId: number }) {
  const [options, setOptions] = useState<GateOptions | null>(null);
  const [gates, setGates] = useState<EntryGates | null>(null);
  // A clan's choice (null on a creator space, whose events are always for viewers).
  const [viewers, setViewers] = useState<boolean | null>(null);
  const [saved, setSaved] = useState<string>('null');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let alive = true;
    clanFetch(`/api/events/${eventId}/gate`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { gates: EntryGates | null; options: GateOptions; membersChoice?: boolean; openToViewers?: boolean } | null) => {
        if (!alive || !d) return;
        const v = d.membersChoice ? d.openToViewers === true : null;
        setOptions(d.options);
        setGates(d.gates);
        setViewers(v);
        setSaved(JSON.stringify([d.gates, v]));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [eventId]);

  const dirty = JSON.stringify([gates, viewers]) !== saved;

  async function save(): Promise<boolean> {
    setBusy(true);
    setNote(null);
    try {
      const res = await clanFetch(`/api/events/${eventId}/gate`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(viewers == null ? { gates } : { gates, openToViewers: viewers }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error ?? 'Could not save');
      const v = viewers == null ? null : d.openToViewers === true;
      setGates(d.gates ?? null);
      setViewers(v);
      setSaved(JSON.stringify([d.gates ?? null, v]));
      setNote({ ok: true, text: 'Saved.' });
      return true;
    } catch (e) {
      setNote({ ok: false, text: (e as Error).message });
      return false;
    } finally {
      setBusy(false);
    }
  }

  // The tab's save bar (settings/SaveBar), then the early return: hooks run on every render.
  const inBar = useSaveBar('gate', 'Who can join', options != null && dirty, () => save(), () => {
    setNote(null);
    try {
      const [g, v] = JSON.parse(saved ?? '[null,null]');
      setGates(g);
      setViewers(v);
    } catch {
      /* nothing saved yet to go back to */
    }
  });
  if (!options) return null;

  return (
    <SettingsCard title="Who can join?" flush>
      <div className="px-5 py-4">
        {viewers != null && (
          <div className="mb-4 space-y-2" role="radiogroup" aria-label="Who can join?">
            {[
              { v: false, label: 'Members only', hint: 'Your clan, as always.' },
              { v: true, label: 'Members and viewers', hint: 'Viewers from your stream can join this event. They play this event only.' },
            ].map((o) => (
              <label key={String(o.v)} className="flex cursor-pointer items-start gap-2.5 text-[13.5px]">
                <Radio name="who-can-join" className="mt-1" checked={viewers === o.v} onChange={() => setViewers(o.v)} />
                <span>
                  <span className="font-semibold">{o.label}</span>
                  <span className="block text-[12.5px] text-text-muted">{o.hint}</span>
                </span>
              </label>
            ))}
          </div>
        )}
        {viewers !== false && (
          <>
            {viewers === true && <p className="mb-2 text-[12.5px] font-semibold text-foreground/80">Which viewers?</p>}
            <EntryGatePicker value={gates} onChange={setGates} options={options} />
          </>
        )}
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            hidden={inBar}
            onClick={save}
            disabled={busy || !dirty}
            className="rounded-lg bg-gold px-4 py-1.5 text-[13px] font-semibold text-brown-dark transition-colors hover:bg-gold-light disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
          {note && <span className={`text-[12.5px] ${note.ok ? 'text-accent-green-light' : 'text-accent-red'}`}>{note.text}</span>}
        </div>
      </div>
    </SettingsCard>
  );
}
