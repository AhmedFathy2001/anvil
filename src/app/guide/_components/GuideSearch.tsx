'use client';

import { useMemo, useState } from 'react';
import ClanLink from '@/components/ClanLink';
import { rank } from '../_i18n/searchRank';

export interface GuideCard {
  page: string;
  href: string;
  eyebrow: string;
  title: string;
  blurb: string;
  minutes: string;
  /** Language-neutral jargon and symptom words — see _i18n/searchTerms. */
  terms: string[];
}

export interface SearchLabels {
  placeholder: string;
  /** "3 guides" — {n} is substituted. */
  results: string;
  empty: string;
  clear: string;
}

/**
 * Find-a-guide, by meaning rather than by substring.
 *
 * A plain `includes()` filter over titles answers almost nothing here, because nobody searching for
 * the board guide types "Building a board that tracks itself" — they type "tiles", "csv", or "drops
 * not showing". So every guide carries jargon and symptom words alongside its translated copy, a
 * query is scored token by token across all three, and near-misses still match: one typo is
 * forgiven on anything long enough for that to mean a typo rather than a different word.
 *
 * Multi-word queries AND rather than OR — "discord webhook" should not return every guide that says
 * Discord once. A token nothing scores on drops the guide entirely.
 */
export default function GuideSearch({
  cards,
  labels,
  children,
}: {
  cards: GuideCard[];
  labels: SearchLabels;
  /** The normal grouped listing, shown whenever the box is empty. */
  children: React.ReactNode;
}) {
  const [query, setQuery] = useState('');

  const hits = useMemo(() => rank(query, cards), [query, cards]);

  return (
    <>
      <div className="relative mb-8">
        <span aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-dim">
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <circle cx="7" cy="7" r="4.4" />
            <path d="M10.4 10.4L14 14" />
          </svg>
        </span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={labels.placeholder}
          aria-label={labels.placeholder}
          className="w-full rounded-xl border border-card-border bg-card-bg py-2.5 pl-10 pr-10 text-sm outline-none transition-colors placeholder:text-text-dim focus:border-gold/40"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label={labels.clear}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-text-dim transition-colors hover:text-foreground"
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.7}>
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        )}
      </div>

      {hits === null ? (
        children
      ) : hits.length === 0 ? (
        <p className="rounded-xl border border-card-border bg-card-bg px-5 py-8 text-center text-sm text-text-muted">
          {labels.empty}
        </p>
      ) : (
        <section>
          <h2 className="mb-3 text-[11px] uppercase tracking-widest text-text-muted">
            {labels.results.replace('{n}', String(hits.length))}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {hits.map((card) => (
              <ClanLink
                key={card.page}
                href={card.href}
                className="group rounded-xl border border-card-border bg-card-bg p-5 transition-colors hover:border-gold/40"
              >
                <div className="mb-2 text-[11px] uppercase tracking-widest text-gold">{card.eyebrow}</div>
                <div className="mb-1 text-lg font-semibold transition-colors group-hover:text-gold-light">
                  {card.title}
                </div>
                <p className="mb-3 text-sm text-text-muted">{card.blurb}</p>
                <div className="text-xs text-text-muted">{card.minutes}</div>
              </ClanLink>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
