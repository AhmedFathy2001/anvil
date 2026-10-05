'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import type { MembershipConflict } from '@/lib/homeClan';

// "Two clans list this character in game — which one is yours?" A roster sync never moves a
// membership between clans (lib/guestAdmission), so when two rosters both claim a character the
// person decides (lib/homeClan). Hides itself when there is nothing to decide.
export default function HomeClanConflicts({ initial }: { initial: MembershipConflict[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState('');

  if (initial.length === 0) return null;

  async function choose(seatId: number) {
    setBusy(seatId);
    setError('');
    // /api/me is the person's, not a clan's — a plain fetch, never prefixed.
    const res = await fetch('/api/me/home-clan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seatId }),
    });
    if (res.ok) router.refresh();
    else setError((await res.json().catch(() => null))?.error ?? 'That did not work.');
    setBusy(null);
  }

  return (
    <div className="mb-4 rounded-lg border border-gold/30 bg-gold/5 p-3">
      <div className="mb-1 text-sm font-semibold text-gold">Which clan are you in?</div>
      <p className="mb-2 text-[12.5px] text-text-muted">
        Two clans&rsquo; in-game rosters list the same character. A character is a member of one clan on Anvil —
        pick the one you&rsquo;re really in; you stay a guest of the other.
      </p>
      <div className="space-y-2">
        {initial.map((c) => (
          <div key={c.listedBy.seatId} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">{c.rsn}</span>
            <span className="text-text-muted">
              is a member of <span className="text-foreground">{c.member.name}</span>, and {c.listedBy.name} lists it too.
            </span>
            <button
              disabled={busy === c.listedBy.seatId}
              onClick={() => choose(c.listedBy.seatId)}
              className="ml-auto rounded-lg border border-gold/40 bg-gold/10 px-3 py-1 text-xs text-gold hover:bg-gold/20 disabled:opacity-50"
            >
              I&rsquo;m in {c.listedBy.name}
            </button>
          </div>
        ))}
      </div>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
