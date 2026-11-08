'use client';

import { useId, useMemo, useRef, useState } from 'react';

import ClanLink from '@/components/ClanLink';
import Input from '@/components/Input';
import { revealHash } from '@/components/HashReveal';
import { resolveMemberHref, searchMemberSettings, type MemberSettingsCard } from '@/lib/memberSettingsIndex';

/** After a click: ring the target. A jump within the same page fires no route change, so do it here. */
function reveal(href: string, fallback?: string) {
  const at = href.indexOf('#');
  if (at >= 0) revealHash(href.slice(at), fallback);
}

/** One area of settings on the hub: what it controls, in a sentence, and straight there. */
export function SettingsCard({ card }: { card: MemberSettingsCard }) {
  return (
    <ClanLink
      href={card.href}
      onClick={() => reveal(card.href)}
      className="group flex gap-3 rounded-xl border border-card-border bg-card-bg px-4 py-3.5 transition-colors hover:border-gold/40 hover:bg-card-bg-hover"
    >
      <span
        className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md border border-tile-border bg-tile-bg text-[13px] text-gold"
        aria-hidden
      >
        {card.icon}
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 text-[14px] font-medium text-foreground group-hover:text-gold-light">
          {card.title}
          <span className="text-gold opacity-0 transition-opacity group-hover:opacity-100" aria-hidden>
            →
          </span>
        </span>
        <span className="mt-0.5 block text-[12.5px] leading-snug text-text-muted">{card.blurb}</span>
      </span>
    </ClanLink>
  );
}

const EXAMPLES = ['private messages', 'rare drop value', 'death message', 'name colour', 'plugin token'];

/**
 * "Where do I change X?" for members: a search box over lib/memberSettingsIndex. Results link to
 * the exact section (#anchor), which components/HashReveal scrolls to and rings on arrival.
 */
export function MemberSettingsSearch({ mainAccountId }: { mainAccountId: number | null }) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const linkRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const baseId = useId();
  const listId = `${baseId}-list`;
  const typed = query.trim();

  const results = useMemo(
    () => (typed ? searchMemberSettings(typed).map((e) => ({ entry: e, href: resolveMemberHref(e.href, mainAccountId) })) : []),
    [typed, mainAccountId],
  );

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!results.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (i + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      linkRefs.current[active]?.click();
    } else if (e.key === 'Escape') {
      setQuery('');
    }
  };

  return (
    <div>
      <label htmlFor={`${baseId}-input`} className="sr-only">
        Search your settings
      </label>
      <div className="relative">
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-dim"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="8.5" cy="8.5" r="5.5" />
          <path d="m13 13 4 4" strokeLinecap="round" />
        </svg>
        <Input
          id={`${baseId}-input`}
          type="search"
          role="combobox"
          aria-expanded={results.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={results.length ? `${baseId}-opt-${active}` : undefined}
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKey}
          placeholder="Search settings: PMs, rare drops, name colour, token…"
          className="h-11 rounded-xl bg-card-bg pl-9 text-[14px]"
        />
      </div>

      {typed ? (
        results.length > 0 ? (
          <ul id={listId} role="listbox" aria-label="Matching settings" className="mt-2 divide-y divide-card-border-soft rounded-xl border border-card-border bg-card-bg">
            {results.map(({ entry, href }, i) => (
              <li key={entry.id} id={`${baseId}-opt-${i}`} role="option" aria-selected={i === active} onMouseMove={() => i !== active && setActive(i)}>
                <ClanLink
                  href={href}
                  ref={(el: HTMLAnchorElement | null) => {
                    linkRefs.current[i] = el;
                  }}
                  tabIndex={-1}
                  onClick={() => reveal(href, entry.fallbackAnchor)}
                  className={`block px-4 py-2.5 ${i === active ? 'bg-gold/10' : ''}`}
                >
                  <span className="flex items-baseline justify-between gap-3">
                    <span className={`truncate text-[14px] font-medium ${i === active ? 'text-gold-light' : 'text-foreground'}`}>{entry.label}</span>
                    <span className="max-w-[45%] shrink-0 truncate text-right text-[11px] text-text-dim">{entry.section}</span>
                  </span>
                  <span className="mt-0.5 block text-[12.5px] text-text-muted">{entry.description}</span>
                </ClanLink>
              </li>
            ))}
          </ul>
        ) : (
          <p id={listId} className="mt-2 text-[13px] text-text-muted">
            Nothing matches &ldquo;{typed}&rdquo;. Try a broader word, like <em>drops</em>, <em>chat</em> or <em>character</em>, or pick
            an area below.
          </p>
        )
      ) : (
        <p className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1.5 text-[12.5px] text-text-dim">
          Try
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => {
                setQuery(ex);
                setActive(0);
              }}
              className="rounded-full border border-card-border px-2 py-px text-text-muted transition-colors hover:border-gold/40 hover:text-foreground"
            >
              {ex}
            </button>
          ))}
        </p>
      )}
    </div>
  );
}
