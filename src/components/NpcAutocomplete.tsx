'use client';

import { useEffect, useRef, useState } from 'react';

// Compact single-pick NPC-name search, backed by /api/admin/npc-search (OSRS Wiki monster list).
// Kill tiles match by NPC name (no id), so onPick returns the name string and the caller owns the
// chosen-names list. Used by the Quick Build tile grid so kill tiles get autocomplete instead of
// hand-typed, pipe-separated names.
export default function NpcAutocomplete({
  onPick,
  placeholder = 'Search NPCs…',
  excludeNames,
}: {
  onPick: (name: string) => void;
  placeholder?: string;
  excludeNames?: string[];
}) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<string[]>([]);
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
    fetch(`/api/admin/npc-search?q=${encodeURIComponent(query)}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((rs: { name: string }[]) => {
        const exclude = new Set((excludeNames ?? []).map((n) => n.toLowerCase()));
        setResults(rs.map((r) => r.name).filter((n) => !exclude.has(n.toLowerCase())));
        setActive(0);
        setOpen(true);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  function pick(name: string) {
    onPick(name);
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
          {results.map((name, i) => (
            <li key={name}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(name)}
                className={`block w-full truncate px-2 py-1.5 text-left text-xs ${
                  i === active ? 'bg-gold/15 text-gold' : 'text-foreground hover:bg-card-bg-hover'
                }`}
              >
                {name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
