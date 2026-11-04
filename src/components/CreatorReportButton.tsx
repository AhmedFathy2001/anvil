'use client';

import { useState } from 'react';

import { clanFetch } from '@/lib/clanFetch';

/**
 * "Report" on a creator page's panel (or the page itself). Signed-in viewers only — the caller does
 * not render it for anyone else. Lands in the platform staff queue (/staff/promotions).
 */
export default function CreatorReportButton({ clanId, panelId = null, label = 'Report' }: { clanId: number; panelId?: number | null; label?: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);

  if (state === 'sent') return <span className="text-[11.5px] text-text-dim">Reported — thanks.</span>;

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-[11.5px] text-text-dim underline-offset-4 hover:text-gold hover:underline">
        {label}
      </button>
    );
  }

  return (
    <form
      className="mt-2 flex w-full flex-col gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setState('sending');
        setError(null);
        // clan-prefix: platform -- the report route is addressed by the space's id, not its host.
        const res = await clanFetch('/api/space-report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clanId, panelId, reason }),
        });
        if (res.ok) {
          setState('sent');
          return;
        }
        setError((await res.json().catch(() => null))?.error ?? 'That did not send.');
        setState('idle');
      }}
    >
      <textarea
        value={reason}
        maxLength={300}
        rows={2}
        onChange={(e) => setReason(e.target.value)}
        placeholder="What's wrong with it? (optional)"
        className="w-full rounded-lg border border-card-border bg-brown-dark/40 px-2.5 py-1.5 text-[13px] focus:border-gold/50 focus:outline-none"
      />
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={state === 'sending'}
          className="rounded-lg border border-card-border px-2.5 py-1 text-[12px] hover:border-gold/45 disabled:opacity-50"
        >
          {state === 'sending' ? 'Sending…' : 'Send report'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-[12px] text-text-dim hover:text-foreground">
          Cancel
        </button>
      </div>
      {error && <p className="text-[12px] text-accent-red">{error}</p>}
    </form>
  );
}
