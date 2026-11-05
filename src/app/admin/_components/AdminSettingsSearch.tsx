'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from 'react';

import ClanLink, { useClanRelativePath } from '@/components/ClanLink';
import { revealHash } from '@/components/HashReveal';
import type { AdminAccess } from '@/lib/adminAccess';
import {
  GUIDE_ENTRIES,
  NEW_SETTING_IDS,
  pathOf,
  resolveHref,
  searchSettings,
  startingPoints,
  visibleSettings,
  type SettingEntry,
} from '@/lib/adminSettingsIndex';
import { settingsViewer } from '@/lib/adminSettingsViewer';
import type { FeatureKey } from '@/lib/features';

/** The sidebar's trigger and the dialog are separate components; this is how one opens the other. */
const OPEN_EVENT = 'anvil:open-settings-search';

export function openSettingsSearch() {
  window.dispatchEvent(new Event(OPEN_EVENT));
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

interface Row {
  entry: SettingEntry;
  href: string;
}

interface Group {
  title: string;
  rows: Row[];
}

const NEW = new Set(NEW_SETTING_IDS);

/**
 * Admin settings search: Ctrl/Cmd+K anywhere in the admin area, or the rail's trigger. Reads the
 * static catalogue in lib/adminSettingsIndex — every setting, not just every page — filtered to what
 * this viewer can actually open; the path gate is lib/adminAccess `redirectFor`, the same one the
 * admin layout enforces. Nothing typed shows what is new and what admins open most, so the box also
 * answers "what is there?" for someone who doesn't know what to type.
 */
export default function AdminSettingsSearch({
  access,
  features,
  creator = false,
}: {
  access: AdminAccess;
  /** Feature keys this clan has switched on. */
  features: readonly FeatureKey[];
  /** A creator space: leave out the in-game-clan pages it is turned away from. */
  creator?: boolean;
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
  // Inside an event, its settings open on THAT event rather than the events list.
  const here = useClanRelativePath();

  const viewer = useMemo(() => settingsViewer(access, features, creator), [access, features, creator]);
  const entries = useMemo(() => visibleSettings(viewer), [viewer]);
  const guides = useMemo(() => visibleSettings(viewer, GUIDE_ENTRIES), [viewer]);

  const groups = useMemo((): Group[] => {
    const row = (entry: SettingEntry): Row => ({ entry, href: resolveHref(entry, here) });
    if (!query.trim()) {
      const { fresh, popular } = startingPoints(entries);
      return [
        { title: 'New', rows: fresh.map(row) },
        { title: 'Popular', rows: popular.map(row) },
      ].filter((g) => g.rows.length > 0);
    }
    return [
      { title: 'Settings', rows: searchSettings(query, entries, 10).map(row) },
      { title: 'From the guides', rows: searchSettings(query, guides, 4).map(row) },
    ].filter((g) => g.rows.length > 0);
  }, [query, entries, guides, here]);

  const rows = useMemo(() => groups.flatMap((g) => g.rows), [groups]);

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

  const choose = (row: Row) => {
    setOpen(false);
    const at = row.href.indexOf('#');
    if (at < 0) return;
    // Same page: the router moves no pathname and fires no hashchange, so ring it from here. On
    // another page components/HashReveal does it on arrival; calling it here too just starts the
    // wait for the element sooner.
    revealHash(row.href.slice(at), row.entry.fallbackAnchor);
  };

  const onInputKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (rows.length ? (i + 1) % rows.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (rows.length ? (i - 1 + rows.length) % rows.length : 0));
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
  const typed = query.trim();
  let index = -1;

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
            aria-expanded={rows.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={rows.length ? optionId(active) : undefined}
            autoComplete="off"
            spellCheck={false}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onInputKey}
            placeholder="Deaths, webhooks, boosts, roles, billing…"
            className="h-12 flex-1 bg-transparent text-[15px] text-foreground placeholder:text-text-dim focus:outline-none"
          />
          <kbd className="rounded border border-card-border px-1.5 py-0.5 text-[10px] text-text-dim">Esc</kbd>
        </div>

        <div id={listId} role="listbox" aria-label="Settings" className="max-h-[60vh] overflow-y-auto py-1.5">
          {groups.map((group) => (
            <div key={group.title} role="group" aria-label={group.title}>
              <div className="px-4 pb-1 pt-2.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-text-dim">{group.title}</div>
              {group.rows.map((row) => {
                index += 1;
                const i = index;
                const { entry } = row;
                const on = i === active;
                // An event setting opened outside any event lands on the events list first.
                const viaList = entry.needsEvent && pathOf(row.href) === '/admin/events';
                return (
                  <div key={`${group.title}-${entry.id}`} id={optionId(i)} role="option" aria-selected={on} onMouseMove={() => !on && setActive(i)}>
                    <ClanLink
                      href={row.href}
                      ref={(el: HTMLAnchorElement | null) => {
                        linkRefs.current[i] = el;
                      }}
                      tabIndex={-1}
                      onClick={() => choose(row)}
                      className={`mx-1.5 block rounded-lg px-3 py-2 ${on ? 'bg-gold/10' : ''}`}
                    >
                      <span className="flex items-baseline justify-between gap-3">
                        <span className={`flex min-w-0 items-baseline gap-2 text-sm font-medium ${on ? 'text-gold-light' : 'text-foreground'}`}>
                          {entry.guide && <span className="shrink-0 text-[11px] font-normal text-text-dim">Guide:</span>}
                          <span className="truncate">{entry.label}</span>
                          {NEW.has(entry.id) && (
                            <span className="shrink-0 rounded-full border border-gold/40 px-1.5 text-[10px] font-semibold uppercase tracking-wide text-gold">
                              New
                            </span>
                          )}
                        </span>
                        <span className="max-w-[45%] shrink-0 truncate text-right text-[11px] text-text-dim">{entry.section}</span>
                      </span>
                      <span className="mt-0.5 line-clamp-2 block text-[12.5px] text-text-muted">{entry.description}</span>
                      {viaList && <span className="mt-0.5 block text-[11px] text-text-dim">Opens your events list: pick one, then {entry.section}.</span>}
                    </ClanLink>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {typed && rows.length === 0 && (
          <p className="px-4 pb-4 pt-2 text-sm text-text-muted">
            Nothing matches &ldquo;{typed}&rdquo;. Try a broader word, like <em>discord</em>, <em>rules</em> or{' '}
            <em>roles</em>.
          </p>
        )}
        <p className="border-t border-card-border px-4 py-2.5 text-[12px] text-text-dim">
          {typed
            ? 'Arrows to move, Enter to open. It opens on the setting itself.'
            : 'Type what you are after: a setting, a channel, a role, a word like “deaths” or “dink”.'}
        </p>
      </div>
    </div>
  );
}
