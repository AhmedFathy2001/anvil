'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { clanFetch } from '@/lib/clanFetch';
import { killPickHits, killPickLabel } from '@/lib/tileCreatorConfig';

/**
 * "+ Add another boss (kills count together)": the monsters on a kills tile, as removable chips with
 * a small search. Same sources as the full editor's kill picker — hiscores bosses, in-game counters
 * (awakened DT2 bosses, Herbiboar…), and the wiki monster list. Picks are hiscores keys for bosses
 * and exact names for everything else; lib/killSource decides the engine from them.
 */
export default function KillPicksField({ picks, onChange }: { picks: string[]; onChange: (picks: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [npcs, setNpcs] = useState<string[]>([]);
  const seq = useRef(0);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 3) return;
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      try {
        const res = await clanFetch(`/api/admin/npc-search?q=${encodeURIComponent(query)}`);
        const data = res.ok ? ((await res.json()) as { name: string }[]) : [];
        if (mine === seq.current) setNpcs(Array.isArray(data) ? data.map((d) => d.name) : []);
      } catch {
        if (mine === seq.current) setNpcs([]);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  // Ranked and typo-tolerant (lib/fuzzySearch): "zulra" still offers Zulrah.
  const hits = useMemo(() => killPickHits(q, npcs, picks), [q, npcs, picks]);

  return (
    <div className="mb-4">
      <ul aria-label="Monsters whose kills count" className="flex flex-wrap gap-1.5">
        {picks.map((p) => (
          <li key={p} className="flex items-center gap-1 rounded-full border border-red-400/30 bg-red-500/10 pl-3 pr-1 text-sm">
            <span>{killPickLabel(p)}</span>
            <button
              type="button"
              aria-label={`Remove ${killPickLabel(p)}`}
              disabled={picks.length <= 1}
              onClick={() => onChange(picks.filter((x) => x !== p))}
              className="w-11 h-11 -my-2 grid place-items-center text-text-muted hover:text-foreground disabled:opacity-30"
            >
              <span aria-hidden="true">&times;</span>
            </button>
          </li>
        ))}
      </ul>
      {open ? (
        <div className="relative mt-2">
          <input
            aria-label="Add a boss or monster"
            autoFocus
            placeholder="Add a boss or monster…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full min-h-11 px-3 rounded-lg bg-brown-dark border border-card-border text-sm focus:outline-none focus:border-gold"
          />
          {hits.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full max-h-64 overflow-y-auto rounded-lg border border-card-border bg-brown-dark divide-y divide-card-border/60 shadow-xl">
              {hits.map((h) => (
                <li key={h.value}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange([...picks, h.value]);
                      setQ('');
                      setOpen(false);
                    }}
                    className="w-full min-h-11 text-left px-3 text-sm hover:bg-gold/10 flex items-center justify-between gap-2"
                  >
                    <span>{h.label}</span>
                    <span className="text-[11px] text-text-muted">{h.note}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="mt-1 min-h-11 text-sm text-gold hover:text-gold-light">
          + Add another boss (kills count together)
        </button>
      )}
    </div>
  );
}
