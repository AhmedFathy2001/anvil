'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import type { LockerOtherAccount } from '@/lib/profileLocker';
import Checkbox from '@/components/Checkbox';

/**
 * Your accounts that this clan has no seat for.
 *
 * Everything else on the locker is scoped to the clan whose site you are on, and should be. This
 * list is the exception, for one reason: the accounts a person most wants to publish — or most
 * wants kept back — are precisely the ones the clan they are looking at cannot see, and a switch you
 * could only reach from a clan that already knew about the account would be no use.
 *
 * Deliberately thin. It is not a second account list; it is where the switch lives.
 */
export default function OtherAccountsClient({ accounts }: { accounts: LockerOtherAccount[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState('');

  async function setShared(accountId: number, shared: boolean) {
    setBusyId(accountId);
    setError('');
    try {
      const res = await fetch(`/api/profile/accounts/${accountId}/share`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shared }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? 'Could not change that.');
        return;
      }
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mt-4">
      <div className="text-xs uppercase tracking-wider text-text-muted mb-2">
        Your other accounts &mdash; this clan cannot see these
      </div>
      <p className="text-xs text-text-muted mb-2.5">
        They&rsquo;re not on this clan&rsquo;s roster, so nobody here can see them. Only you see this
        list. Turning on Share lets clans you aren&rsquo;t in see that account &mdash; useful when you
        apply somewhere or play against them, and off until you say otherwise.
      </p>
      {error && <p className="text-xs text-red-300 mb-2">{error}</p>}
      <div className="space-y-1.5">
        {accounts.map((a) => (
          <div
            key={a.accountId}
            className="flex items-center gap-3 border border-card-border rounded-lg px-3.5 py-2 bg-brown-dark/25"
          >
            <span className="text-sm">{a.rsn}</span>
            <Checkbox
              checked={a.shared}
              disabled={busyId === a.accountId}
              onChange={(next) => setShared(a.accountId, next)}
              className="ml-auto"
              label="Share"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
