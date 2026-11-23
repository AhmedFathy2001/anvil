'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { useDialog } from '@/components/Confirm';
import { clanFetch } from '@/lib/clanFetch';

type FundPlan = 'bronze' | 'silver' | 'gold';

/**
 * The owner's clan fund controls (lib/clanFund): start it for one plan, change the plan while it is
 * still collecting, or turn it off once no chip-in counts.
 */
export default function FundControls({
  current,
  locked,
  options,
  blockedReason,
}: {
  /** The plan the fund is for, or null when there is none. */
  current: FundPlan | null;
  /** The fund pays for its plan now: the plan can't change. */
  locked: boolean;
  options: { id: FundPlan; label: string; goal: string }[];
  /** Why a fund can't start (a membership already pays for the plan), or null. */
  blockedReason: string | null;
}) {
  const router = useRouter();
  const { confirm, notify } = useDialog();
  const [pick, setPick] = useState<FundPlan>(current ?? 'silver');
  const [busy, setBusy] = useState(false);

  async function send(plan: FundPlan | null) {
    setBusy(true);
    try {
      const res = await clanFetch('/api/admin/clan-fund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) notify(data.error ?? 'Could not save that.', 'error');
      else router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    const yes = await confirm({
      title: 'Turn off the clan fund?',
      body: 'Members stop seeing it. This only works once nobody\'s chip-in is still running.',
      confirmLabel: 'Turn off',
      tone: 'danger',
    });
    if (yes) await send(null);
  }

  if (blockedReason && !current) return <p className="text-[13px] leading-relaxed text-orange-200">{blockedReason}</p>;

  return (
    <div className="flex flex-col gap-3">
      {!locked && (
        <div>
          <div className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-text-muted">{current ? 'Fund for' : 'Start a fund for'}</div>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Plan to fund">
            {options.map((o) => (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={pick === o.id}
                onClick={() => setPick(o.id)}
                className={`rounded-lg border px-3 py-2 text-left text-[13px] transition-colors ${
                  pick === o.id ? 'border-gold bg-gold/10 text-gold' : 'border-card-border text-foreground hover:border-gold/45'
                }`}
              >
                <span className="font-semibold">{o.label}</span>
                <span className="ml-1.5 text-text-muted">{o.goal}/yr</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {!locked && pick !== current && (
          <button
            type="button"
            disabled={busy}
            onClick={() => send(pick)}
            className="h-10 rounded-lg bg-gold px-4 text-[13.5px] font-semibold text-brown-dark transition-colors hover:bg-gold-light disabled:opacity-50"
          >
            {current ? 'Change the plan' : 'Start the fund'}
          </button>
        )}
        {current && (
          <button
            type="button"
            disabled={busy}
            onClick={turnOff}
            className="h-10 rounded-lg border border-card-border px-4 text-[13.5px] text-foreground transition-colors hover:border-red-500/40 hover:text-red-300 disabled:opacity-50"
          >
            Turn off
          </button>
        )}
      </div>
    </div>
  );
}
