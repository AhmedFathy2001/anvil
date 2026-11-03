'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from 'react';

import ClanLink from '@/components/ClanLink';
import type { AdminAccess } from '@/lib/adminAccess';
import { searchSettings, visibleSettings, type SettingEntry } from '@/lib/adminSettingsIndex';
import { settingsViewer } from '@/lib/adminSettingsViewer';
import type { FeatureKey } from '@/lib/features';

/** The sidebar's trigger and the dialog are separate components; this is how one opens the other. */
const OPEN_EVENT = 'anvil:open-settings-search';

export function openSettingsSearch() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

/**
 * Land on an #anchor that may not exist yet (the page is still loading) and may sit inside a folded
 * <details> (Discord, Rules & scoring). Next scrolls to a hash it can find, but never opens a fold.
 */
function revealHash(hash: string) {
  const id = hash.replace(/^#/, '');
  if (!id) return;
  let tries = 0;
  const tick = () => {
    const el = document.getElementById(id);
    if (!el) {
      if (++tries < 40) window.setTimeout(tick, 100);
      return;
    }
    for (let node: HTMLElement | null = el; node; node = node.parentElement) {
      if (node instanceof HTMLDetailsElement) node.open = true;
    }
    el.scrollIntoView({ block: 'start' });
  };
  tick();
}

const noSubscribe = () => () => {};

function isMac(): boolean {
  return typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
}

/** The subtle "Search settings  Ctrl K" row at the top of the admin rail. */
export function SettingsSearchTrigger({ onOpen }: { onOpen?: () => void }) {
  // Server render and hydration say "Ctrl K"; the client corrects it on a Mac without an effect.
  const mac = useSyncExternalStore(noSubscribe, isMac, () => false);
  return (
    <button
      type="button"
      onClick={() => {
        onOpen?.();
        openSettingsSearch();
      }}
      className="mb-4 flex w-full items-center gap-2 rounded-lg border border-card-border bg-card-bg/60 px-3 py-2 text-sm text-text-muted transition-colors hover:border-gold/30 hover:text-foreground"
    >
      <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 shrink-0 opacity-70" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="8.5" cy="8.5" r="5.5" />
        <path d="m13 13 4 4" strokeLinecap="round" />
      </svg>
      <span className="flex-1 text-left">Search settings</span>
      <kbd className="rounded border border-card-border px-1.5 py-0.5 font-sans text-[10px] text-text-dim">
        {mac ? '⌘K' : 'Ctrl K'}
      </kbd>
    </button>
  );
}

/**
 * Admin settings search: Ctrl/Cmd+K anywhere in the admin area, or the rail's trigger. Reads the
 * static catalogue in lib/adminSettingsIndex, filtered to what this viewer can actually open — the
 * path gate is lib/adminAccess `redirectFor`, the same one the admin layout enforces.
 */
export default function AdminSettingsSearch({
  access,
  features,
}: {
  access: AdminAccess;
  /** Feature keys this clan has switched on. */
  features: readonly FeatureKey[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const linkRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const returnFocus = useRef<HTMLElement | null>(null);
  const baseId = useId();
  const listId = `${baseId}-list`;
  const titleId = `${baseId}-title`;

  const entries = useMemo(() => visibleSettings(settingsViewer(access, features)), [access, features]);

  const results = useMemo(() => searchSettings(query, entries, 12), [query, entries]);

  const show = useCallback(() => {
    returnFocus.current = document.activeElement as HTMLElement | null;
    setQuery('');
    setActive(0);
    setOpen(true);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    returnFocus.current?.focus?.();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (open) close();
        else show();
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener(OPEN_EVENT, show);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener(OPEN_EVENT, show);
    };
  }, [open, show, close]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Keep the highlighted row in view as the arrows move it.
  useEffect(() => {
    linkRefs.current[active]?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  if (!open) return null;

  const choose = (entry: SettingEntry) => {
    setOpen(false);
    const hash = entry.href.includes('#') ? entry.href.slice(entry.href.indexOf('#')) : '';
    if (hash) revealHash(hash);
  };

  const onInputKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (results.length ? (i + 1) % results.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (results.length ? (i - 1 + results.length) % results.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      // Clicking the row's own link keeps ClanLink in charge of the address (clan prefix, hard
      // navigation across clans) rather than rebuilding it here.
      linkRefs.current[active]?.click();
    } else if (e.key === 'Tab') {
      // The input is the dialog's only stop; arrows move through the results.
      e.preventDefault();
    }
  };

  const optionId = (i: number) => `${baseId}-opt-${i}`;

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/60 px-4 pt-[12vh]" onMouseDown={close}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-xl overflow-hidden rounded-xl border border-card-border bg-card-bg shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="sr-only">
          Search settings
        </h2>
        <div className="flex items-center gap-2 border-b border-card-border px-4">
          <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-text-dim" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="8.5" cy="8.5" r="5.5" />
            <path d="m13 13 4 4" strokeLinecap="round" />
          </svg>
          <label htmlFor={`${baseId}-input`} className="sr-only">
            Search admin settings
          </label>
          <input
            id={`${baseId}-input`}
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={results.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={results.length ? optionId(active) : undefined}
            autoComplete="off"
            spellCheck={false}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onInputKey}
            placeholder="Webhooks, roles, billing, rules…"
            className="h-12 flex-1 bg-transparent text-[15px] text-foreground placeholder:text-text-dim focus:outline-none"
          />
          <kbd className="rounded border border-card-border px-1.5 py-0.5 text-[10px] text-text-dim">Esc</kbd>
        </div>

        <ul id={listId} role="listbox" aria-label="Settings" className="max-h-[60vh] overflow-y-auto py-1.5">
          {results.map((entry, i) => (
            <li
              key={entry.id}
              id={optionId(i)}
              role="option"
              aria-selected={i === active}
              onMouseMove={() => i !== active && setActive(i)}
            >
              <ClanLink
                href={entry.href}
                ref={(el: HTMLAnchorElement | null) => {
                  linkRefs.current[i] = el;
                }}
                tabIndex={-1}
                onClick={() => choose(entry)}
                className={`mx-1.5 block rounded-lg px-3 py-2 ${i === active ? 'bg-gold/10' : ''}`}
              >
                <span className="flex items-baseline justify-between gap-3">
                  <span className={`truncate text-sm font-medium ${i === active ? 'text-gold-light' : 'text-foreground'}`}>
                    {entry.label}
                  </span>
                  <span className="shrink-0 text-[11px] text-text-dim">{entry.section}</span>
                </span>
                <span className="mt-0.5 line-clamp-2 block text-[12.5px] text-text-muted">{entry.description}</span>
              </ClanLink>
            </li>
          ))}
        </ul>

        {query.trim() && results.length === 0 && (
          <p className="px-4 pb-4 pt-2 text-sm text-text-muted">
            Nothing matches &ldquo;{query.trim()}&rdquo;. Try a broader word, like <em>discord</em>, <em>rules</em> or{' '}
            <em>roles</em>.
          </p>
        )}
        {!query.trim() && (
          <p className="px-4 pb-4 pt-2 text-sm text-text-muted">
            Find any setting by name: a channel, a role, a rule, billing. Arrows to move, Enter to open.
          </p>
        )}
      </div>
    </div>
  );
}
