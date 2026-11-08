'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { useDialog } from '@/components/Confirm';
import Select from '@/components/Select';
import { clanFetch } from '@/lib/clanFetch';

/**
 * Recovery: Anvil staff hand the clan to one of its admins now — no request, no 3-day hold. A reason
 * is required and both people are told (lib/ownershipTransfers staffTransferNow).
 */
export default function StaffTransferNow({ clanId, clanName, admins }: { clanId: number; clanName: string; admins: { userId: number; name: string }[] }) {
  const { ask, notify } = useDialog();
  const router = useRouter();
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);

  if (admins.length === 0) {
    return <p className="text-sm text-text-muted">No admins to hand it to — make someone an admin first.</p>;
  }

  async function go() {
    const target = admins.find((a) => String(a.userId) === to);
    if (!target) return;
    const reason = await ask({
      title: `Make ${target.name} the owner of ${clanName} now?`,
      body: 'Recovery only: this skips the 3-day hold and supersedes any pending request. The current owner becomes an ordinary admin. Both of them are told, with your reason.',
      label: 'Reason (both people see this)',
      required: true,
      multiline: true,
      confirmLabel: 'Transfer now',
      tone: 'danger',
    });
    if (!reason) return;
    setBusy(true);
    const res = await clanFetch('/api/staff/ownership-transfers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'transfer-now', clanId, toUserId: target.userId, reason }),
    });
    setBusy(false);
    if (!res.ok) {
      notify((await res.json().catch(() => null))?.error ?? 'That did not work.', 'error');
      return;
    }
    notify(`${target.name} now owns ${clanName}`);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="min-w-[14rem] flex-1">
        <Select
          value={to}
          onChange={setTo}
          options={admins.map((a) => ({ value: String(a.userId), label: a.name }))}
          placeholder="Pick an admin…"
          ariaLabel="New owner"
        />
      </div>
      <button
        onClick={() => void go()}
        disabled={!to || busy}
        className="rounded-lg border border-red-500/50 px-3 py-2 text-sm text-red-300 transition-colors hover:bg-red-500/10 disabled:opacity-40"
      >
        Transfer now
      </button>
    </div>
  );
}
