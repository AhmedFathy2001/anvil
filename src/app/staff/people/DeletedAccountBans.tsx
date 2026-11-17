'use client';

import { useState } from 'react';

import { useDialog } from '@/components/Confirm';
import { parseStamp } from '@/lib/dbTime';

interface Ban {
  id: number;
  discordId: string;
  bannedAt: string;
}

function dayOf(stamp: string): string {
  const ms = parseStamp(stamp);
  return ms == null ? '' : new Date(ms).toISOString().slice(0, 10);
}

/**
 * Platform bans on accounts that have since been deleted (lib/deletedAccountBans). No person is
 * left, so there is no card for one above: the Discord account is refused at sign-in until the ban
 * is lifted here.
 */
export default function DeletedAccountBans({ initial, canWrite }: { initial: Ban[]; canWrite: boolean }) {
  const [bans, setBans] = useState(initial);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { confirm } = useDialog();

  if (bans.length === 0) return null;

  async function lift(ban: Ban) {
    const ok = await confirm({
      title: 'Lift this platform ban?',
      body: 'The account it was set on has been deleted. That Discord account will be able to sign in and start a new one.',
      confirmLabel: 'Lift the ban',
    });
    if (!ok) return;
    setBusy(ban.id);
    setError(null);
    try {
      const res = await fetch('/api/staff/people/deleted-bans', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: ban.id }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? 'Could not lift the ban');
      setBans((v) => v.filter((b) => b.id !== ban.id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="mt-8 rounded-xl border border-card-border bg-card-bg p-4">
      <h2 className="text-lg font-semibold">Platform-banned, account deleted</h2>
      <p className="mt-1 text-sm text-gray-400">
        These people deleted their account while platform-banned. Their Discord account still cannot sign in.
      </p>
      {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
      <ul className="mt-3 space-y-1.5">
        {bans.map((ban) => (
          <li key={ban.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="font-medium">Deleted account</span>
            <span className="text-xs text-gray-400">Discord id {ban.discordId}</span>
            <span className="text-xs text-gray-400">banned {dayOf(ban.bannedAt)}</span>
            {canWrite && (
              <button
                onClick={() => lift(ban)}
                disabled={busy === ban.id}
                className="ml-auto rounded-lg border border-card-border px-2.5 py-1 text-xs hover:border-gold/50 disabled:opacity-50"
              >
                {busy === ban.id ? 'Lifting…' : 'Lift the ban'}
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
