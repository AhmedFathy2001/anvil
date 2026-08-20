'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { BoardProblem } from '@/lib/boardMisconfig';
import { clanFetch } from '@/lib/clanFetch';
import ClanLink from '@/components/ClanLink';

/**
 * Fixing a running board.
 *
 * Editing a live event is normal — a tile watches the wrong item, a quantity is off by a zero,
 * someone needs subbing — but the admin surfaces treated mid-event edits as an afterthought, and
 * the one action that repairs the damage afterwards (recompute, which back-fills completions for
 * anything that already met its target) was buried in a settings list.
 *
 * So: what's wrong, where to fix it, and the heal button, in one place on the live page.
 */
export default function LiveFixPanel({
  eventId,
  problems,
  hasStatTiles,
}: {
  eventId: number;
  problems: BoardProblem[];
  /** Stat tiles measure against a baseline, so a wrong baseline is its own kind of misconfigured. */
  hasStatTiles: boolean;
}) {
  const router = useRouter();
  const [recomputing, setRecomputing] = useState(false);
  const [message, setMessage] = useState('');
  const [expanded, setExpanded] = useState(false);

  const base = `/admin/events/${eventId}`;
  const broken = problems.filter((p) => p.severity === 'broken');
  const shown = expanded ? problems : problems.slice(0, 3);

  async function recompute() {
    setRecomputing(true);
    setMessage('');
    try {
      const res = await clanFetch(`/api/events/${eventId}/recompute-completions`, { method: 'POST' });
      if (res.ok) {
        const { healed } = await res.json();
        setMessage(
          healed > 0
            ? `${healed} tile${healed === 1 ? '' : 's'} completed that had already met their target.`
            : 'Nothing to heal — every tile is up to date.',
        );
        router.refresh();
      } else {
        setMessage('That failed — try again.');
      }
    } catch {
      setMessage('That failed — try again.');
    } finally {
      setRecomputing(false);
    }
  }

  return (
    <section
      className={`border rounded-xl p-5 ${
        broken.length > 0 ? 'border-amber-400/40 bg-amber-400/[0.07]' : 'border-card-border bg-card-bg'
      }`}
    >
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <span className={`w-1 h-5 rounded-full ${broken.length > 0 ? 'bg-amber-400' : 'bg-text-muted'}`} />
          Fix something mid-event
        </h2>
        {broken.length > 0 && (
          <span className="text-xs font-medium px-2 py-1 rounded-full bg-amber-400/20 text-amber-300">
            {broken.length} tile{broken.length === 1 ? '' : 's'} can&apos;t credit
          </span>
        )}
      </div>

      {problems.length > 0 ? (
        <>
          <p className="text-sm text-text-muted mb-3">
            These tiles will never complete on their own as they&apos;re set up. Fix the tile, then heal the board —
            anything that already met its target completes retroactively.
          </p>
          <div className="space-y-2">
            {shown.map((p) => (
              <div
                key={`${p.tileId}-${p.problem}`}
                className="flex items-center gap-3 p-2.5 rounded-lg border border-card-border bg-black/20"
              >
                <span
                  className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                    p.severity === 'broken' ? 'bg-amber-400/20 text-amber-300' : 'bg-white/[0.07] text-text-muted'
                  }`}
                >
                  #{p.position}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium truncate">{p.label}</span>
                  <span className="block text-xs text-text-muted">
                    {p.problem} — {p.fix}
                  </span>
                </span>
                <ClanLink
                  href={`${base}/tiles?tile=${p.tileId}`}
                  className="px-2.5 py-1 text-xs rounded-lg border border-card-border hover:border-gold/50 hover:text-gold transition-colors whitespace-nowrap"
                >
                  Open tile
                </ClanLink>
              </div>
            ))}
          </div>
          {problems.length > 3 && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-2 text-xs text-gold hover:underline"
            >
              {expanded ? 'Show fewer' : `Show all ${problems.length}`}
            </button>
          )}
        </>
      ) : (
        <p className="text-sm text-text-muted mb-3">
          Every tile on this board can credit itself. If something still isn&apos;t counting, the usual suspects are
          below.
        </p>
      )}

      <div className="mt-4 pt-4 border-t border-card-border flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={recompute}
          disabled={recomputing}
          title="Re-checks every tile against what's already been submitted, and completes anything that had already met its target. Only adds completions — it never takes one away."
          className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gold/30 text-gold bg-gold/10 hover:bg-gold/20 transition-colors disabled:opacity-50"
        >
          {recomputing ? 'Healing…' : 'Heal the board'}
        </button>
        <ClanLink
          href={`${base}/tiles`}
          className="px-3 py-1.5 text-xs rounded-lg border border-card-border text-text-muted hover:text-foreground transition-colors"
        >
          Edit tiles
        </ClanLink>
        <ClanLink
          href={`${base}/settings`}
          className="px-3 py-1.5 text-xs rounded-lg border border-card-border text-text-muted hover:text-foreground transition-colors"
        >
          Rules &amp; reveal
        </ClanLink>
        <ClanLink
          href={`${base}/teams`}
          className="px-3 py-1.5 text-xs rounded-lg border border-card-border text-text-muted hover:text-foreground transition-colors"
        >
          Subs &amp; rosters
        </ClanLink>
        {hasStatTiles && (
          <ClanLink
            href={`${base}/stats`}
            className="px-3 py-1.5 text-xs rounded-lg border border-card-border text-text-muted hover:text-foreground transition-colors"
          >
            Fix baselines
          </ClanLink>
        )}
        {message && <span className="text-xs text-text-muted">{message}</span>}
      </div>
    </section>
  );
}
