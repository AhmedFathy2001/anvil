'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

// Re-pick one side of a comparison without retyping the other: "Change" under a name opens an inline
// field, and submitting keeps the opposite side as it is. The "vs" badge swaps the two.
// clan-prefix: platform -- /compare and /compare/clans are the apex's; a comparison belongs to no one clan.

function compareHref(basePath: string, a: string, b: string): string {
  return `${basePath}?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}`;
}

export function ChangeSide({
  basePath,
  side,
  current,
  other,
  noun,
  maxLength,
  align,
}: {
  basePath: string;
  side: 'a' | 'b';
  /** This side's name as it is in the URL now. */
  current: string;
  /** The opposite side, kept as it is. */
  other: string;
  noun: 'player' | 'clan';
  maxLength: number;
  align: 'left' | 'right';
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [found, setFound] = useState<{ slug: string; name: string }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  // Clans are addressed by slug, which nobody knows — so suggest listed clans by name as you type
  // (the public lookup the plugin uses) and navigate by the picked one's slug.
  useEffect(() => {
    if (noun !== 'clan') return;
    const q = value.trim();
    if (q.length < 2) return;
    const ctl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/clans/lookup?q=${encodeURIComponent(q)}`, { signal: ctl.signal })
        .then((r) => (r.ok ? r.json() : { clans: [] }))
        .then((j: { clans?: { slug: string; name: string }[] }) => setFound(j.clans ?? []))
        .catch(() => {});
    }, 200);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [value, noun]);

  // Short queries show nothing rather than whatever an earlier, longer one found.
  const suggestions = noun === 'clan' && value.trim().length >= 2 ? found : [];

  function go(name: string) {
    if (!name || name.toLowerCase() === current.toLowerCase()) {
      setEditing(false);
      return;
    }
    router.push(side === 'a' ? compareHref(basePath, name, other) : compareHref(basePath, other, name));
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={`mt-1.5 inline-flex items-center gap-1 text-xs text-text-dim transition-colors hover:text-gold ${
          align === 'right' ? 'flex-row-reverse' : ''
        }`}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
        Change {noun}
      </button>
    );
  }

  return (
    <form
      className={`relative mt-1.5 flex items-center gap-1.5 ${align === 'right' ? 'justify-end' : ''}`}
      onSubmit={(e) => {
        e.preventDefault();
        // A clan typed by name goes to its top suggestion; anything else is taken as the address.
        go(suggestions.length > 0 ? suggestions[0].slug : value.trim());
      }}
    >
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setEditing(false);
        }}
        placeholder={noun === 'player' ? 'Another player' : 'Another clan'}
        aria-label={side === 'a' ? `First ${noun}` : `Second ${noun}`}
        maxLength={maxLength}
        autoComplete="off"
        className="w-40 rounded-lg border border-card-border bg-background px-2.5 py-1 text-sm text-foreground placeholder:text-text-dim focus:border-gold focus:outline-none"
      />
      <button type="submit" className="rounded-lg bg-gold px-2.5 py-1 text-xs font-semibold text-brown-dark hover:bg-gold-light">
        Compare
      </button>
      <button type="button" onClick={() => setEditing(false)} className="text-xs text-text-muted hover:text-foreground">
        Cancel
      </button>
      {suggestions.length > 0 && (
        <ul
          className={`absolute top-full z-20 mt-1 w-56 overflow-hidden rounded-lg border border-card-border bg-card-bg py-1 text-left shadow-xl shadow-black/40 ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {suggestions.map((c) => (
            <li key={c.slug}>
              <button
                type="button"
                onClick={() => go(c.slug)}
                className="block w-full truncate px-3 py-1.5 text-left text-sm text-foreground hover:bg-brown-light"
              >
                {c.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}

/** The "vs" badge, as a link that swaps the two sides. */
export function SwapSides({ basePath, a, b, className }: { basePath: string; a: string; b: string; className: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      title="Swap sides"
      aria-label="Swap sides"
      onClick={() => router.push(compareHref(basePath, b, a))}
      className={`group ${className} transition-colors hover:border-gold/60 hover:text-gold`}
    >
      <span className="group-hover:hidden">vs</span>
      <span className="hidden text-sm group-hover:inline" aria-hidden>
        ⇄
      </span>
    </button>
  );
}
