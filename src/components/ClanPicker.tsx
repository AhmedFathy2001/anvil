'use client';

import { useEffect, useId, useRef, useState } from 'react';
import ClanCrest from '@/components/ClanCrest';
import { clanFetch } from '@/lib/clanFetch';

export interface PickedClan {
  slug: string;
  name: string;
  logoUrl: string | null;
}

/**
 * Search for a clan by name or address and pick one (api/clans/search) — for inviting a clan to an
 * event or as a co-host, where the host used to have to know the exact slug. Typing a full address
 * still works for clans that keep themselves out of the directory.
 */
export default function ClanPicker({
  value,
  onChange,
  disabled,
  placeholder = 'Search clans by name or address',
}: {
  value: PickedClan | null;
  onChange: (clan: PickedClan | null) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PickedClan[]>([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const searching = query.trim().length >= 2;
  const shown = searching ? results : [];

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    let cancelled = false;
    const t = setTimeout(() => {
      setLoading(true);
      clanFetch(`/api/clans/search?q=${encodeURIComponent(q)}`)
        .then((r) => (r.ok ? r.json() : { clans: [] }))
        .then((d: { clans?: PickedClan[] }) => {
          if (cancelled) return;
          setResults(d.clans ?? []);
          setHighlight(0);
        })
        .catch(() => {})
        .finally(() => !cancelled && setLoading(false));
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const pick = (c: PickedClan) => {
    onChange(c);
    setQuery('');
    setOpen(false);
  };

  if (value) {
    return (
      <div className="flex flex-1 items-center gap-2.5 rounded-lg border border-gold/40 bg-background px-3 py-1.5 text-sm">
        <ClanCrest name={value.name} logoUrl={value.logoUrl} size={24} />
        <span className="font-medium">{value.name}</span>
        <span className="font-mono text-[11px] text-text-muted">c/{value.slug}</span>
        <button
          type="button"
          onClick={() => onChange(null)}
          disabled={disabled}
          aria-label="Choose a different clan"
          className="ml-auto text-text-muted transition-colors hover:text-foreground"
        >
          ×
        </button>
      </div>
    );
  }

  return (
    <div ref={boxRef} className="relative flex-1">
      <input
        value={query}
        disabled={disabled}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlight((h) => Math.min(h + 1, shown.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlight((h) => Math.max(h - 1, 0));
          } else if (e.key === 'Enter' && shown[highlight]) {
            e.preventDefault();
            pick(shown[highlight]);
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
        placeholder={placeholder}
        aria-label="Search clans"
        role="combobox"
        aria-expanded={open && searching}
        aria-controls={listId}
        className="w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-gold/50"
      />
      {open && searching && (
        <ul id={listId} className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-gold/30 bg-card-bg py-1 shadow-xl" role="listbox">
          {shown.length === 0 ? (
            <li className="px-3 py-2 text-[12.5px] text-text-muted">
              {loading ? 'Searching…' : 'No clan found. Unlisted clans show up when you type their full address.'}
            </li>
          ) : (
            shown.map((c, i) => (
              <li key={c.slug} role="option" aria-selected={i === highlight}>
                <button
                  type="button"
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => pick(c)}
                  className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm ${i === highlight ? 'bg-gold/10 text-gold' : ''}`}
                >
                  <ClanCrest name={c.name} logoUrl={c.logoUrl} size={22} />
                  <span className="truncate">{c.name}</span>
                  <span className="ml-auto font-mono text-[11px] text-text-muted">c/{c.slug}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
