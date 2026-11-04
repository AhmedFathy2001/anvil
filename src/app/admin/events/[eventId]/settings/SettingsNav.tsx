'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import ClanLink, { useClanRelativePath } from '@/components/ClanLink';
import { clanUrl } from '@/lib/clanFetch';
import { searchSettings, tabHref, type SettingsKind, type TabInfo } from '@/lib/eventSettingsTabs';

/**
 * The settings tabs and the search box (lib/eventSettingsTabs). `/` focuses the search anywhere on
 * the page; arrows move, Enter opens, Esc closes. Opening a result goes to its tab and brings the
 * setting into view with a brief ring, so "where did it go" has an answer you can see.
 */
export default function SettingsNav({ eventId, kind, tabs }: { eventId: number; kind: SettingsKind; tabs: TabInfo[] }) {
  const router = useRouter();
  const pathname = useClanRelativePath();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const hits = useMemo(() => searchSettings(q, eventId, kind), [q, eventId, kind]);

  // `/` from anywhere that isn't already a text field.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))) return;
      e.preventDefault();
      input.current?.focus();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Arriving with #setting (a search result, or a link from elsewhere): scroll to it and ring it. The
  // tab streams in after navigation, so look for the element for up to a second.
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (!id) return;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const find = () => {
      const el = document.getElementById(id);
      if (!el) {
        if (tries++ < 20) timer = setTimeout(find, 50);
        return;
      }
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      const before = el.style.boxShadow;
      el.style.transition = 'box-shadow .3s';
      el.style.boxShadow = '0 0 0 3px var(--gold)';
      timer = setTimeout(() => {
        el.style.boxShadow = before;
      }, 1800);
    };
    find();
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [pathname]);

  function go(href: string) {
    setOpen(false);
    setQ('');
    input.current?.blur();
    const [path, hash] = href.split('#');
    // Same tab: the router won't re-run the effect above, so ring it here.
    if (path === pathname && hash) {
      window.history.replaceState(null, '', `${window.location.pathname}#${hash}`);
      const el = document.getElementById(hash);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        el.style.transition = 'box-shadow .3s';
        el.style.boxShadow = '0 0 0 3px var(--gold)';
        setTimeout(() => (el.style.boxShadow = ''), 1800);
      }
      return;
    }
    router.push(clanUrl(href));
  }

  return (
    <div className="mb-6 flex flex-wrap items-end gap-x-4 gap-y-2 border-b border-card-border">
      <nav className="-mb-px flex max-w-full flex-none gap-1 overflow-x-auto overflow-y-hidden scroll-quiet" aria-label="Settings">
        {tabs.map((t) => {
          const href = tabHref(eventId, t.key);
          const active = t.slug ? pathname.startsWith(href) : pathname === href;
          return (
            <ClanLink
              key={t.key}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`relative whitespace-nowrap px-3.5 py-2.5 text-sm font-medium transition-colors ${active ? 'text-gold' : 'text-text-muted hover:text-foreground'}`}
            >
              {t.label}
              {active && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-gold" aria-hidden />}
            </ClanLink>
          );
        })}
      </nav>

      <div className="relative mb-2 ml-auto w-full sm:w-64">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
        <input
          ref={input}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setSel(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setSel((n) => Math.min(n + 1, Math.max(0, hits.length - 1)));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setSel((n) => Math.max(0, n - 1));
            } else if (e.key === 'Enter' && hits[sel]) {
              e.preventDefault();
              go(hits[sel].href);
            } else if (e.key === 'Escape') {
              setOpen(false);
              input.current?.blur();
            }
          }}
          placeholder="Search settings"
          aria-label="Search settings"
          aria-expanded={open && hits.length > 0}
          aria-controls="settings-search-results"
          role="combobox"
          className="h-10 w-full rounded-lg border border-card-border bg-brown-dark pl-9 pr-9 text-sm placeholder:text-text-dim focus:border-gold/60 focus:outline-none"
        />
        <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-card-border px-1.5 text-[11px] text-text-muted" aria-hidden>
          /
        </kbd>
        {open && q.trim() !== '' && (
          <div
            id="settings-search-results"
            role="listbox"
            className="absolute right-0 top-12 z-40 w-full min-w-[18rem] overflow-hidden rounded-xl border border-card-border bg-card-bg-hover p-1.5 shadow-[0_18px_44px_rgba(0,0,0,.55)] sm:w-96"
          >
            {hits.length === 0 ? (
              <p className="px-3 py-2.5 text-sm text-text-muted">Nothing called that. Try a word like “reveal”, “dates” or “co-host”.</p>
            ) : (
              hits.map((h, i) => (
                <button
                  key={h.id}
                  type="button"
                  role="option"
                  aria-selected={i === sel}
                  onMouseEnter={() => setSel(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => go(h.href)}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm ${i === sel ? 'bg-brown-light' : ''}`}
                >
                  <span className="truncate">{h.label}</span>
                  <span className={`shrink-0 text-xs ${h.elsewhere ? 'text-gold' : 'text-text-muted'}`}>
                    {h.where}
                    {h.elsewhere ? ' ↗' : ''}
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
