'use client';

import { useState } from 'react';

import { useDialog } from '@/components/Confirm';
import { clanFetch } from '@/lib/clanFetch';
import { parseStamp } from '@/lib/dbTime';
import type { DeletedAccountBan } from '@/lib/deletedAccountBans';

/** The day a ban was set, whichever of the two stored time formats it is in. */
function dayOf(stamp: string): string {
  const ms = parseStamp(stamp);
  return ms == null ? '' : new Date(ms).toISOString().slice(0, 10);
}

/**
 * This clan's bans on accounts that have since been deleted.
 *
 * Deleting an account does not end a ban: if the same Discord account signs in again it is banned
 * from this clan again. Nobody is left to name, so each shows as "Deleted account" with the date and
 * the clan's own reason. Lifting one removes it for good. Admin only, like every other ban.
 */
export default function DeletedAccountBans({ initial }: { initial: DeletedAccountBan[] }) {
  const [bans, setBans] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { confirm } = useDialog();

  if (bans.length === 0) return null;

  async function lift(ban: DeletedAccountBan) {
    const ok = await confirm({
      title: 'Lift this ban?',
      body:
        ban.kind === 'returned'
          ? 'They will be able to join this clan again. They are not added back automatically.'
          : 'The account it was set on has been deleted. If its owner signs in again they will be able to join this clan.',
      confirmLabel: 'Lift the ban',
    });
    if (!ok) return;
    setBusy(`${ban.kind}-${ban.id}`);
    setError(null);
    try {
      const res = await clanFetch('/api/admin/clan/deleted-bans', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: ban.id, kind: ban.kind }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? 'Could not lift the ban');
      setBans((v) => v.filter((b) => !(b.id === ban.id && b.kind === ban.kind)));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="mb-6 mt-6 rounded-xl border border-card-border bg-card-bg p-4">
      <div className="mb-1 flex items-center gap-2">
        <span className="h-5 w-1 shrink-0 rounded-sm bg-gold" />
        <h2 className="text-[15px] font-semibold">
          Banned, not on the roster
          <span className="ml-2 text-[12px] font-normal text-text-muted">{bans.length}</span>
        </h2>
      </div>
      <p className="mb-2.5 text-xs text-text-muted">
        Banned accounts that are not on the roster, including deleted accounts. A deleted account&apos;s old seat can
        still be counted under Departed above. The ban still applies when they sign in again.
      </p>
      {error && <p className="mb-2 text-xs text-red-300">{error}</p>}
      <ul className="space-y-1.5">
        {bans.map((ban) => (
          <li key={`${ban.kind}-${ban.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="font-medium">{ban.kind === 'returned' ? 'Deleted account, signed in again' : 'Deleted account'}</span>
            <span className="text-xs text-text-muted">banned {dayOf(ban.bannedAt)}</span>
            <span className="min-w-0 flex-1 text-xs text-text-muted">{ban.reason ? `Reason: ${ban.reason}` : 'No reason given'}</span>
            <button
              onClick={() => lift(ban)}
              disabled={busy === `${ban.kind}-${ban.id}`}
              className="rounded-lg border border-card-border px-2.5 py-1 text-xs hover:border-gold/50 disabled:opacity-50"
            >
              {busy === `${ban.kind}-${ban.id}` ? 'Lifting…' : 'Lift the ban'}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
