'use client';

import { useEffect, useRef, useState } from 'react';

export interface PickedItem {
  id: number;
  name: string;
}

// Compact single-pick item search, backed by /api/admin/items-search (the same source the
// importer resolves names against, so a picked item always resolves cleanly). Calls onPick with
// the {id, name} and clears itself; the caller owns the list of chosen items. Used by the Quick
// Build tile grid so drop/collection tiles get real autocomplete instead of hand-typed names/ids.
export default function ItemAutocomplete({
  onPick,
  placeholder = 'Search items…',
  excludeIds,
}: {
  onPick: (item: PickedItem) => void;
  placeholder?: string;
  excludeIds?: number[];
}) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<PickedItem[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  function runSearch(query: string) {
    if (query.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    fetch(`/api/admin/items-search?q=${encodeURIComponent(query)}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((rs: PickedItem[]) => {
        const exclude = new Set(excludeIds ?? []);
        setResults(rs.filter((r) => !exclude.has(r.id)));
        setActive(0);
        setOpen(true);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  function pick(item: PickedItem) {
    onPick(item);
    setQ('');
    setResults([]);
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        value={q}
        placeholder={placeholder}
        onChange={(e) => {
          const v = e.target.value;
          setQ(v);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => runSearch(v), 250);
        }}
        onKeyDown={(e) => {
          if (!open || results.length === 0) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, results.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === 'Enter') {
            e.preventDefault();
            pick(results[active]);
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
        className="w-full bg-brown-dark border border-card-border rounded px-2 py-1 text-xs text-foreground placeholder:text-text-muted/60 focus:border-gold/50 focus:outline-none"
      />
      {loading && <span className="absolute right-2 top-1.5 text-[10px] text-text-muted">…</span>}
      {open && results.length > 0 && (
        <ul className="absolute z-30 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-card-border bg-card-bg shadow-xl">
          {results.map((r, i) => (
            <li key={r.id}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(r)}
                className={`flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs ${
                  i === active ? 'bg-gold/15 text-gold' : 'text-foreground hover:bg-card-bg-hover'
                }`}
              >
                <span className="truncate">{r.name}</span>
                <span className="ml-auto shrink-0 text-[10px] text-text-muted">#{r.id}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
