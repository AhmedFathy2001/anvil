'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { useDialog } from '@/components/Confirm';
import { clanFetch } from '@/lib/clanFetch';

interface Candidate {
  userId: number;
  name: string;
  role: string;
  canPay: boolean;
}

const ROLE_WORD: Record<string, string> = { admin: 'admin', treasurer: 'treasurer', moderator: 'mod' };

/**
 * The owner's "Who can pay for the plan" (lib/planPayers): let an admin, treasurer or moderator pay,
 * or stop them. Stopping the person paying now asks first, since their membership keeps running.
 */
export default function PlanPayers({
  candidates,
  payingUserId,
  confirmText,
}: {
  candidates: Candidate[];
  payingUserId: number | null;
  confirmText: { title: string; body: string } | null;
}) {
  const router = useRouter();
  const { confirm, notify } = useDialog();
  const [busy, setBusy] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const allowed = candidates.filter((c) => c.canPay);
  const others = candidates.filter((c) => !c.canPay);

  async function set(c: Candidate, on: boolean) {
    if (!on && c.userId === payingUserId && confirmText) {
      const yes = await confirm({ title: confirmText.title, body: confirmText.body, confirmLabel: 'Remove permission', cancelLabel: 'Keep', tone: 'danger' });
      if (!yes) return;
    }
    setBusy(c.userId);
    try {
      const res = await clanFetch('/api/admin/plan-payers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: c.userId, on }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) notify(data.error ?? 'Could not save that.', 'error');
      else {
        setAdding(false);
        router.refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="mt-5 rounded-xl border border-card-border bg-card-bg p-5">
      <h2 className="text-lg font-semibold">Who can pay for the plan</h2>
      <p className="mt-1 max-w-[66ch] text-[13.5px] leading-relaxed text-text-muted">
        They can subscribe, change tier and manage the membership they started. It stays theirs: on their Gumroad account, their
        card, and only they can cancel it.
      </p>
      <ul className="mt-4 flex flex-col gap-2">
        <li className="flex items-center gap-3 rounded-lg border border-card-border px-3 py-2.5">
          <div className="flex-1">
            <div className="text-[14px]">You (owner)</div>
            <div className="text-[12px] text-text-muted">Always can</div>
          </div>
        </li>
        {allowed.map((c) => (
          <li key={c.userId} className="flex items-center gap-3 rounded-lg border border-card-border px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px]">
                {c.name} <span className="text-text-muted">· {ROLE_WORD[c.role] ?? c.role}</span>
              </div>
              <div className={`text-[12px] ${c.userId === payingUserId ? 'text-accent-green-light' : 'text-text-muted'}`}>
                {c.userId === payingUserId ? 'Paying now' : 'Can pay · not paying'}
              </div>
            </div>
            <button
              type="button"
              disabled={busy === c.userId}
              onClick={() => set(c, false)}
              className="h-9 rounded-md border border-red-500/40 px-3 text-[12.5px] text-red-300 transition-colors hover:bg-red-500/10 disabled:opacity-50"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      {others.length > 0 &&
        (adding ? (
          <ul className="mt-2 flex flex-col gap-2">
            {others.map((c) => (
              <li key={c.userId} className="flex items-center gap-3 rounded-lg border border-dashed border-card-border px-3 py-2.5">
                <div className="min-w-0 flex-1 truncate text-[14px]">
                  {c.name} <span className="text-text-muted">· {ROLE_WORD[c.role] ?? c.role}</span>
                </div>
                <button
                  type="button"
                  disabled={busy === c.userId}
                  onClick={() => set(c, true)}
                  className="h-9 rounded-md border border-gold/45 px-3 text-[12.5px] font-semibold text-gold transition-colors hover:bg-gold/10 disabled:opacity-50"
                >
                  Let pay
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="mt-2 w-full rounded-lg border border-dashed border-card-border px-3 py-2.5 text-left text-[13px] text-text-muted transition-colors hover:text-foreground"
          >
            + Let an admin, treasurer or mod pay
          </button>
        ))}
      {others.length === 0 && allowed.length === 0 && (
        <p className="mt-2 text-[12.5px] text-text-muted">Give someone an admin, treasurer or moderator role first, then let them pay here.</p>
      )}
    </section>
  );
}
