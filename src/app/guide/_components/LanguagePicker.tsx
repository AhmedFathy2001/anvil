'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import ClanLink from '@/components/ClanLink';

/**
 * The language control for the guides.
 *
 * It was fifteen chips wrapped across two lines, which is a list rather than a control: every
 * language shouted equally, the one you were reading was a slightly different colour, and the row
 * grew every time a translation was added.
 *
 * THE ONE PROPERTY WORTH KEEPING is that each language is its own URL — no cookie, no client state
 * deciding what you read — so a Danish player can paste /guide/da/plugin into clan chat and everyone
 * who opens it gets Danish. So the options here are real links: middle-click, open-in-new-tab and
 * copy-link all still do what they should. The search is only a way to find the row.
 *
 * Matching is on both names: someone looking for their own language types "Dansk", and someone
 * looking for somebody else's types "Danish".
 */
export interface PickerLocale {
  code: string;
  label: string;
  english: string;
  dir: 'ltr' | 'rtl';
  complete: boolean;
  href: string;
}

export default function LanguagePicker({
  locales,
  current,
  label,
}: {
  locales: PickerLocale[];
  current: string;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const here = locales.find((l) => l.code === current) ?? locales[0];
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return locales;
    return locales.filter(
      (l) => l.label.toLowerCase().includes(q) || l.english.toLowerCase().includes(q) || l.code === q,
    );
  }, [locales, query]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => {
        const next = e.key === 'ArrowDown' ? i + 1 : i - 1;
        return Math.max(0, Math.min(matches.length - 1, next));
      });
      return;
    }
    if (e.key === 'Enter' && matches[active]) {
      // Follow it as a navigation rather than calling .click(): the anchor is rendered by ClanLink,
      // which may need to do a full document load, and that decision belongs to it.
      (boxRef.current?.querySelector(`[data-i="${active}"]`) as HTMLAnchorElement | null)?.click();
    }
  }

  return (
    <div ref={boxRef} className="relative mb-6 inline-block text-xs" onKeyDown={onKey}>
      <span className="mr-2 uppercase tracking-widest text-text-muted/70">{label}</span>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-2.5 py-1 text-gold transition-colors hover:border-gold/60"
      >
        <span lang={here.code} dir={here.dir}>
          {here.label}
        </span>
        <span aria-hidden className="text-[9px] opacity-70">
          ▼
        </span>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-60 overflow-hidden rounded-xl border border-card-border bg-card-bg shadow-xl shadow-black/30">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              // Reset the highlight with the query that moved it, not in an effect afterwards —
              // otherwise Enter follows whatever row happens to be sitting at the old index.
              setActive(0);
            }}
            placeholder="Search languages…"
            aria-label="Search languages"
            className="w-full border-b border-card-border bg-transparent px-3 py-2 text-[13px] text-foreground outline-none placeholder:text-text-muted/60"
          />
          <ul role="listbox" className="max-h-72 overflow-y-auto py-1">
            {matches.length === 0 && (
              <li className="px-3 py-2 text-text-muted">No language matches that.</li>
            )}
            {matches.map((l, i) => (
              <li key={l.code} role="option" aria-selected={l.code === current}>
                <ClanLink
                  href={l.href}
                  data-i={i}
                  hrefLang={l.code}
                  lang={l.code}
                  dir={l.dir}
                  onMouseEnter={() => setActive(i)}
                  className={`flex items-baseline justify-between gap-3 px-3 py-1.5 transition-colors ${
                    i === active ? 'bg-brown-light' : ''
                  } ${l.code === current ? 'text-gold' : 'text-text-muted hover:text-foreground'}`}
                >
                  <span>{l.label}</span>
                  <span className="text-[10.5px] text-text-muted/60">
                    {l.english}
                    {!l.complete && ' ·'}
                  </span>
                </ClanLink>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
