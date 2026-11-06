'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ClanBoostGift({ clanId, level: initialLevel, expiresAt }: { clanId: number; level: number | null; expiresAt: string | null }) {
  const router = useRouter();
  const [level, setLevel] = useState(initialLevel ?? 0);
  const [days, setDays] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  async function save(nextLevel = level) {
    setBusy(true); setNote(null);
    const res = await fetch(`/api/staff/clans/${clanId}/boost-grant`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ level: nextLevel, days: days.trim() || null }) });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setNote(json.error ?? 'Could not save the gift.');
    setNote(nextLevel ? 'Boost gift saved.' : 'Boost gift cleared.');
    router.refresh();
  }
  return (
    <div className="rounded-xl border border-card-border bg-card-bg p-4">
      <p className="text-sm text-text-muted">Set a minimum clan boost tier. Leave duration blank for an indefinite gift; organic member boosts can still raise it higher.</p>
      {initialLevel ? <p className="mt-2 text-xs text-gold">Currently Tier {initialLevel} · {expiresAt ? `until ${expiresAt.slice(0, 10)}` : 'indefinitely'}</p> : null}
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="text-xs text-text-muted">Tier<select value={level} onChange={(e) => setLevel(Number(e.target.value))} className="mt-1 block rounded-lg border border-card-border bg-background px-3 py-2 text-foreground"><option value={1}>Tier 1</option><option value={2}>Tier 2</option><option value={3}>Tier 3</option></select></label>
        <label className="text-xs text-text-muted">Duration in days<input value={days} onChange={(e) => setDays(e.target.value)} inputMode="numeric" placeholder="blank = indefinitely" className="mt-1 block w-44 rounded-lg border border-card-border bg-background px-3 py-2 text-foreground" /></label>
        <button disabled={busy} onClick={() => void save()} className="rounded-lg bg-gold px-3 py-2 text-sm font-semibold text-brown-dark disabled:opacity-50">{busy ? 'Saving…' : 'Gift boost'}</button>
        {initialLevel ? <button disabled={busy} onClick={() => void save(0)} className="rounded-lg border border-card-border px-3 py-2 text-sm text-text-muted">Clear gift</button> : null}
      </div>
      {note ? <p className="mt-2 text-xs text-text-muted">{note}</p> : null}
    </div>
  );
}
