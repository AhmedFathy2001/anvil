'use client';

import { useCallback, useEffect, useState } from 'react';

import { useDialog } from '@/components/Confirm';
import Select from '@/components/Select';
import { clanFetch } from '@/lib/clanFetch';
import type { PastViewersEvent } from '@/lib/eventPlayers';

interface Data {
  events: PastViewersEvent[];
  guests: { seatId: number; rsn: string }[];
  clanEvents: { id: number; name: string }[];
}

function placeText(rank: number | null, total: number | null): string {
  if (rank == null) return '';
  return total ? `#${rank} of ${total}` : `#${rank}`;
}

/**
 * "Past viewers": everyone who joined one of your streamed events, by event — their team and how it
 * finished. Viewers play one event only and are not on your roster. "Make guest" lets one into your
 * other guest events too; the box at the bottom sends a guest back to being one event's viewer.
 */
export default function PastViewersClient() {
  const { confirm, notify } = useDialog();
  const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState(false);
  const [guestSeat, setGuestSeat] = useState('');
  const [guestEvent, setGuestEvent] = useState('');

  const load = useCallback(() => {
    clanFetch('/api/admin/viewers')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setData(d as Data))
      .catch(() => {});
  }, []);
  useEffect(load, [load]);

  async function post(body: Record<string, unknown>, done: string) {
    setBusy(true);
    try {
      const res = await clanFetch('/api/admin/viewers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error ?? 'Could not do that');
      notify(done);
      load();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function makeGuest(seatId: number, rsn: string) {
    const ok = await confirm({
      title: `Make ${rsn} a guest?`,
      body: 'Guests can join any of your events that are open to guests, not just this one.',
      confirmLabel: 'Make guest',
      tone: 'gold',
    });
    if (ok) await post({ action: 'make-guest', seatId }, `${rsn} is now a guest.`);
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <p className="max-w-[70ch] text-sm text-text-muted">
        Viewers joined one of your streamed events. They play that event only. They are not on your roster or guest list.
      </p>

      {data.events.length === 0 ? (
        <div className="rounded-xl border border-card-border bg-card-bg p-5 text-sm text-text-muted">
          No viewers yet. Open an event to viewers from its settings (“Who can join?”).
        </div>
      ) : (
        data.events.map((ev) => (
          <section key={ev.eventId}>
            <h2 className="mb-2 flex items-center gap-2 font-semibold">
              <span className="h-5 w-1 rounded-full bg-gold" aria-hidden />
              {ev.eventName}
              <span className="text-sm font-normal text-text-muted">
                {ev.viewers.length} viewer{ev.viewers.length === 1 ? '' : 's'}
                {ev.over ? ' · ended' : ''}
              </span>
            </h2>
            <ul className="overflow-hidden rounded-xl border border-card-border bg-card-bg">
              {ev.viewers.map((v) => (
                <li key={v.seatId} className="flex flex-wrap items-center justify-between gap-3 border-t border-card-border/70 px-4 py-2.5 text-sm first:border-t-0">
                  <span className="min-w-0 truncate font-medium">{v.rsn}</span>
                  <span className="flex shrink-0 items-center gap-3 text-text-muted">
                    {v.teamName && <span>{v.teamName}</span>}
                    {v.teamRank != null && <span>{placeText(v.teamRank, v.teamsTotal)}</span>}
                    {!v.teamName && v.signupStatus && <span>{v.signupStatus === 'withdrawn' ? 'left' : 'signed up'}</span>}
                    {v.nowGuest ? (
                      <span className="rounded-full border border-card-border px-2 py-0.5 text-[11.5px]">guest now</span>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => makeGuest(v.seatId, v.rsn)}
                        className="rounded-lg border border-gold/50 px-2.5 py-1 text-[12.5px] font-semibold text-gold transition-colors hover:bg-gold/10 disabled:opacity-50"
                      >
                        Make guest
                      </button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      {data.guests.length > 0 && data.clanEvents.length > 0 && (
        <section className="rounded-xl border border-card-border bg-card-bg p-5">
          <h2 className="mb-1 font-semibold">Make a guest a viewer again</h2>
          <p className="mb-3 text-sm text-text-muted">They stop being a guest and can only play the event you pick.</p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="text-sm">
              <span className="mb-1 block text-text-muted">Guest</span>
              <Select
                className="w-56"
                ariaLabel="Guest"
                placeholder="Pick a guest"
                value={guestSeat}
                onChange={setGuestSeat}
                options={data.guests.map((g) => ({ value: String(g.seatId), label: g.rsn }))}
              />
            </div>
            <div className="text-sm">
              <span className="mb-1 block text-text-muted">Event</span>
              <Select
                className="w-64"
                ariaLabel="Event"
                placeholder="Pick an event"
                value={guestEvent}
                onChange={setGuestEvent}
                options={data.clanEvents.map((e) => ({ value: String(e.id), label: e.name }))}
              />
            </div>
            <button
              type="button"
              disabled={busy || !guestSeat || !guestEvent}
              onClick={() =>
                post({ action: 'make-viewer', seatId: Number(guestSeat), eventId: Number(guestEvent) }, 'Done. They are a viewer of that event now.').then(() => {
                  setGuestSeat('');
                  setGuestEvent('');
                })
              }
              className="rounded-xl bg-gold px-4 py-2 text-sm font-semibold text-brown-dark transition-colors hover:bg-gold-light disabled:opacity-50"
            >
              Make viewer
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
