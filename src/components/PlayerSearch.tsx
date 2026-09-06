'use client';

import { useEffect, useRef, useState } from 'react';
import ClanLink from '@/components/ClanLink';
import Input from '@/components/Input';

interface Hit {
  rsn: string;
  overallXp: number | null;
  clanName: string | null;
}

function compact(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}b`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}m`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}

/**
 * Find a character by name.
 *
 * The one primitive a profile page needs and could not be reached by: before this you got to /p/ by
 * placing in a top-25 table or by already knowing the URL. Shared accounts only — the same rule the
 * page itself enforces, so a search can never confirm that a private character exists.
 *
 * Debounced rather than searched per keystroke, and it asks for nothing under two characters: the
 * answer to "a" is most of the platform, which is not an answer.
 */
export default function PlayerSearch({ placeholder = 'Look up a character…' }: { placeholder?: string }) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setHits(null);
      return;
    }
    const mine = ++seq.current;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/players/search?q=${encodeURIComponent(term)}`);
        const data = await res.json().catch(() => ({ results: [] }));
        // A slower earlier request must not overwrite a newer answer.
        if (mine === seq.current) setHits(data.results ?? []);
      } catch {
        if (mine === seq.current) setHits([]);
      } finally {
        if (mine === seq.current) setLoading(false);
      }
    }, 220);
    return () => clearTimeout(timer);
  }, [q]);

  return (
    <div className="relative">
      <Input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        aria-label="Look up a character by name"
        className="sm:w-72"
      />

      {hits !== null && (
        <div className="absolute z-20 mt-1.5 w-full overflow-hidden rounded-xl border border-card-border bg-card-bg shadow-lg sm:w-72">
          {hits.length === 0 ? (
            <p className="px-3.5 py-2.5 text-[12.5px] text-text-muted">
              {loading ? 'Looking…' : 'Nobody by that name has shared a profile.'}
            </p>
          ) : (
            hits.map((h) => (
              <ClanLink
                key={h.rsn}
                href={`/p/${encodeURIComponent(h.rsn)}`}
                className="flex items-center gap-3 px-3.5 py-2 transition-colors hover:bg-brown-light/40"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px]">{h.rsn}</span>
                  {h.clanName && (
                    <span className="block truncate text-[11px] text-text-muted">{h.clanName}</span>
                  )}
                </span>
                {h.overallXp != null && (
                  <span className="shrink-0 font-mono text-[11px] tabular-nums text-text-dim">
                    {compact(h.overallXp)}
                  </span>
                )}
              </ClanLink>
            ))
          )}
        </div>
      )}
    </div>
  );
}
