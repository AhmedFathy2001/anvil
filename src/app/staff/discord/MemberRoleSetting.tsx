'use client';

import { useState } from 'react';

import Input from '@/components/Input';

/** The role "Join the Anvil Discord" gives people (lib/welcomeDm). */
export default function MemberRoleSetting({ initial, canWrite }: { initial: string; canWrite: boolean }) {
  const [value, setValue] = useState(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/staff/discord', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberRoleId: value }),
      });
      const j = await res.json().catch(() => ({}));
      setMsg(res.ok ? { ok: true, text: value ? 'Saved.' : 'Cleared: people join with no role.' } : { ok: false, text: j.error ?? 'That didn’t save.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6 rounded-xl border border-card-border bg-card-bg p-5">
      <h2 className="text-base font-semibold text-gold">Member role</h2>
      <p className="mt-1 text-sm text-text-muted">
        People who tick &ldquo;Join the Anvil Discord&rdquo; when they make a clan, or press it on /supporter, are added to the server
        with this role (your anvil-user role). Right-click the role in Server Settings &rarr; Roles &rarr; Copy Role ID. Leave it empty
        to add them with no role.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Role id"
          disabled={!canWrite}
          className="w-64 rounded-lg px-3 py-2 text-sm outline-none"
        />
        <button
          type="button"
          onClick={() => void save()}
          disabled={!canWrite || busy}
          className="rounded-lg border border-gold/40 px-3 py-2 text-sm text-gold disabled:opacity-40"
        >
          {busy ? 'Saving…' : 'Save'}
        </button>
      </div>
      {msg && <p className={`mt-2 text-xs ${msg.ok ? 'text-emerald-400' : 'text-red-300'}`}>{msg.text}</p>}
    </section>
  );
}
