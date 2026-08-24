'use client';

import { useState } from 'react';
import { clanFetch } from '@/lib/clanFetch';
import Input from '@/components/Input';

// Inline "link this clan member to a Discord user" control, shown next to a member the role sync
// couldn't resolve. Search the guild by name, pick, and it binds + syncs that member.
export default function DiscordLinkMember({ memberId }: { memberId: number }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<{ id: string; label: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  async function search() {
    if (!q.trim()) return;
    setBusy(true);
    try {
      const res = await clanFetch(`/api/admin/discord/guild-members?q=${encodeURIComponent(q.trim())}`);
      setResults(res.ok ? (await res.json()).members ?? [] : []);
    } finally {
      setBusy(false);
    }
  }

  async function link(discordUserId: string) {
    setBusy(true);
    try {
      const res = await clanFetch('/api/admin/discord/link-member', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clanMemberId: memberId, discordUserId }),
      });
      const data = await res.json();
      if (res.ok) {
        const r = data.report;
        setDone(r?.ok ? `linked${r.added?.length ? ` · +${r.added.length} role(s)` : ''}` : `linked · ${r?.reason ?? 'no change'}`);
      } else {
        setDone(data.error || 'failed');
      }
    } catch {
      setDone('failed');
    } finally {
      setBusy(false);
    }
  }

  if (done) return <span className="text-[10px] text-green-400 ml-2">{done}</span>;

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-[10px] text-gold hover:underline ml-2">
        link…
      </button>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-1 ml-2 align-middle">
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && search()}
        placeholder="Discord name…"
        className="text-[11px] px-1.5 py-0.5 w-32 focus:border-gold/50"
      />
      <button onClick={search} disabled={busy} className="text-[10px] text-gold disabled:opacity-50">
        {busy ? '…' : 'search'}
      </button>
      {results.map((r) => (
        <button
          key={r.id}
          onClick={() => link(r.id)}
          disabled={busy}
          className="text-[10px] px-1.5 py-0.5 rounded bg-gold/15 text-gold border border-gold/30 hover:bg-gold/25 disabled:opacity-50"
        >
          {r.label}
        </button>
      ))}
    </span>
  );
}
