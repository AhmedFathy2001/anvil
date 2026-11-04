'use client';

import { useState } from 'react';

import type { SiteReactionChip } from '@/lib/siteReactions';

/**
 * A moment's reaction chips on the site: the counts for anyone, and — for someone who may react
 * here (lib/siteReactions) — who gave each on hover, and a press to give or take back their own.
 * The press flips at once and settles on the server's answer (or rolls back with its reason).
 */
export default function MomentReactions({
  momentId,
  chips: initial,
  canReact,
  target,
}: {
  momentId: number;
  chips: SiteReactionChip[];
  canReact: boolean;
  target: { clanId: number } | { eventId: number };
}) {
  const [chips, setChips] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function press(kind: SiteReactionChip['kind']) {
    if (!canReact || busy) return;
    const before = chips;
    setError(null);
    setBusy(true);
    setChips((cs) => cs.map((c) => (c.kind === kind ? { ...c, mine: !c.mine, n: Math.max(0, c.n + (c.mine ? -1 : 1)) } : c)));
    try {
      const res = await fetch(`/api/moments/${momentId}/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, ...target }),
      });
      const data = (await res.json().catch(() => null)) as { chips?: SiteReactionChip[]; error?: string } | null;
      if (!res.ok || !data?.chips) {
        setChips(before);
        setError(data?.error ?? 'Couldn’t react to that.');
      } else {
        setChips(data.chips);
      }
    } catch {
      setChips(before);
      setError('Couldn’t react to that.');
    } finally {
      setBusy(false);
    }
  }

  if (chips.length === 0) return null;
  return (
    <span className="flex shrink-0 items-center gap-1">
      {chips.map((c) => {
        const gold = c.kind === 'gold';
        const tone = c.mine
          ? gold
            ? 'border-gold bg-gold/25 text-gold'
            : 'border-gold/70 bg-gold/15 text-foreground'
          : 'border-card-border bg-background/40 text-text-muted';
        const tip = c.who ?? (c.n > 0 ? `${c.label} · ${c.n}` : canReact ? `Give a ${c.label}` : c.label);
        const body = (
          <>
            <span className={gold ? 'text-gold' : undefined}>{c.label}</span>
            {c.n > 0 && <span className="font-mono">{c.n}</span>}
          </>
        );
        const cls = `inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10.5px] font-semibold leading-none ${tone}`;
        return canReact ? (
          <button
            key={c.kind}
            type="button"
            onClick={() => press(c.kind)}
            disabled={busy}
            title={tip}
            aria-label={tip}
            aria-pressed={c.mine}
            className={`${cls} cursor-pointer transition-colors hover:border-gold/70 disabled:cursor-wait`}
          >
            {body}
          </button>
        ) : (
          <span key={c.kind} title={tip} className={cls}>
            {body}
          </span>
        );
      })}
      {error && (
        <span role="status" className="text-[10.5px] text-red-400" title={error}>
          {error}
        </span>
      )}
    </span>
  );
}
