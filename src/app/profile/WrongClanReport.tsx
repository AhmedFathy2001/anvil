'use client';

import { useState } from 'react';
import Radio from '@/components/Radio';

export interface WrongClanOption {
  clanId: number;
  name: string;
  kind: 'member' | 'guest';
}

/**
 * "Wrong clan? Tell Anvil" — a character on the wrong clan's member list (lib/wrongClan).
 *
 * Membership comes from the in-game clan list and Anvil never moves it between clans on its own, so
 * this sends it to Anvil staff. The player picks the clan they're really in from the clans that have
 * the character on their list; one that doesn't is "another clan", named in the note — staff can't
 * move them there in one click, but they can see it.
 */
export default function WrongClanReport({
  accountId,
  rsn,
  options,
  label = 'Wrong clan? Tell Anvil',
}: {
  accountId: number;
  rsn: string;
  options: WrongClanOption[];
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  // The clan they're really in; 0 = a clan not listed here.
  const firstGuest = options.find((o) => o.kind === 'guest');
  const [pick, setPick] = useState<number>(firstGuest?.clanId ?? 0);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  if (sent) return <span className="block text-xs text-accent-green-light">Sent to Anvil. Staff will look at it and move it if it’s right.</span>;

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs text-gold/80 underline-offset-2 hover:text-gold hover:underline">
        {label}
      </button>
    );
  }

  async function send() {
    setBusy(true);
    setError('');
    // /api/profile/wrong-clan is the person's, not a clan's — a plain fetch, never prefixed.
    const res = await fetch('/api/profile/wrong-clan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId, clanId: pick || null, note }),
    });
    if (res.ok) setSent(true);
    else setError((await res.json().catch(() => null))?.error ?? 'That did not work — try again.');
    setBusy(false);
  }

  return (
    <div className="mt-1.5 max-w-md rounded-lg border border-card-border bg-brown-dark/40 p-2.5 text-xs">
      <div className="mb-1.5 font-medium text-foreground">Which clan is {rsn} really in?</div>
      <div className="space-y-1">
        {options.map((o) => (
          <label key={o.clanId} className="flex items-center gap-2">
            <Radio name={`wrong-clan-${accountId}`} checked={pick === o.clanId} onChange={() => setPick(o.clanId)} />
            <span>
              {o.name}
              <span className="text-text-muted">{o.kind === 'member' ? ' (member now)' : ' (guest now)'}</span>
            </span>
          </label>
        ))}
        <label className="flex items-center gap-2">
          <Radio name={`wrong-clan-${accountId}`} checked={pick === 0} onChange={() => setPick(0)} />
          <span>Another clan — I’ll name it below</span>
        </label>
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={500}
        rows={2}
        placeholder={pick === 0 ? 'Which clan, and anything that helps Anvil check it' : 'Anything that helps Anvil check it (optional)'}
        className="mt-2 w-full resize-y rounded border border-card-border bg-brown-dark px-2 py-1.5 focus:border-gold/40 focus:outline-none"
      />
      {pick === 0 && (
        <p className="mt-1 text-text-muted">
          If that clan doesn’t have {rsn} on its list yet, Anvil can’t move you there in one go — the clan should sync its
          member list from the plugin.
        </p>
      )}
      {error && <p className="mt-1 text-red-400">{error}</p>}
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          disabled={busy || (pick === 0 && !note.trim())}
          onClick={send}
          className="rounded-lg border border-gold/40 bg-gold/10 px-3 py-1 text-gold hover:bg-gold/20 disabled:opacity-50"
        >
          Send to Anvil
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-card-border px-3 py-1 text-text-muted hover:border-gold/40">
          Cancel
        </button>
      </div>
    </div>
  );
}
