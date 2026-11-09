'use client';

import { useState } from 'react';

import ClanLink from '@/components/ClanLink';
import { entryDate, groupByDate, groupByMonth, splitRecent } from '@/lib/whatsNew';
import { NewBadge } from './WhatsNewTabs';

export interface ListItem {
  id: string;
  date: string;
  title: string;
  body: string;
  /** Why it is shown ("Clan admin", "Supporter"). */
  chips: string[];
  links: { href: string; label: string; signIn: boolean }[];
  pluginNext: boolean;
  /** A signed-out viewer: clan links need sign-in. */
  clanHint: boolean;
  signInHref: string;
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden className={`shrink-0 text-gold transition-transform ${open ? 'rotate-90' : ''}`}>
      <path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function lowerFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

/** One entry: title and a one-line body; click for the full text and the link buttons. */
function Row({ item }: { item: ListItem }) {
  const [open, setOpen] = useState(false);
  const hasMore = item.links.length > 0 || item.clanHint || item.pluginNext || item.body.length > 90;
  return (
    <li className="px-4 py-3 sm:px-5">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start gap-2.5 text-left"
      >
        <span className="mt-1.5">
          <Chevron open={open} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] font-semibold">
            {item.title}
            <NewBadge date={item.date} />
            {item.chips.map((c) => (
              <span key={c} className="rounded-full border border-gold/40 px-2 py-0.5 text-[11px] font-medium text-gold">
                {c}
              </span>
            ))}
          </span>
          {!open && <span className="mt-0.5 block truncate text-[13.5px] text-text-muted">{item.body}</span>}
        </span>
      </button>
      {open && (
        <div className="ml-[22px] mt-1.5">
          <p className="text-[14px] leading-relaxed text-text-muted">{item.body}</p>
          {item.pluginNext && (
            <p className="mt-2 text-[12.5px] text-text-dim">Coming in the next plugin update. RuneLite installs it for you.</p>
          )}
          {(item.links.length > 0 || item.clanHint) && hasMore && (
            <ul className="mt-3 flex flex-wrap items-center gap-2 text-[13.5px]">
              {item.links.map((l) => (
                <li key={`${l.href}|${l.label}`} className="max-w-full">
                  <ClanLink
                    href={l.href}
                    className="inline-flex max-w-full items-center gap-1 rounded-lg border border-gold/40 bg-gold/10 px-3 py-1.5 font-medium text-gold transition-colors hover:border-gold hover:bg-gold/20"
                  >
                    <span className="truncate">{l.signIn ? `Sign in to ${lowerFirst(l.label)}` : l.label}</span>
                    <span aria-hidden>&rarr;</span>
                  </ClanLink>
                </li>
              ))}
              {item.clanHint && (
                <li className="text-text-dim">
                  <ClanLink href={item.signInHref} className="underline-offset-2 hover:text-foreground hover:underline">
                    Sign in
                  </ClanLink>{' '}
                  for a link to your clan&rsquo;s page
                </li>
              )}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

/** Entries under their dates; several on one date share one compact list. */
function DateGroups({ items }: { items: ListItem[] }) {
  return (
    <>
      {groupByDate(items.map((i) => ({ ...i, audience: undefined }))).map((g) => (
        <div key={g.date} className="mb-5">
          <h2 className="mb-2 flex items-center gap-2.5 text-[14px] font-semibold">
            <span className="h-5 w-1 shrink-0 rounded-full bg-gold" aria-hidden />
            <time dateTime={g.date}>{entryDate(g.date)}</time>
          </h2>
          <ol className="divide-y divide-card-border overflow-hidden rounded-xl border border-card-border bg-card-bg">
            {g.entries.map((e) => (
              <Row key={e.id} item={items.find((i) => i.id === e.id)!} />
            ))}
          </ol>
        </div>
      ))}
    </>
  );
}

function MonthGroup({ label, items }: { label: string; items: ListItem[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-3">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2.5 rounded-lg border border-card-border bg-card-bg px-4 py-2.5 text-left text-[14px] font-semibold hover:border-gold/40"
      >
        <Chevron open={open} />
        {label}
        <span className="rounded-full bg-card-border/60 px-1.5 text-[11px] font-normal tabular-nums text-text-dim">{items.length}</span>
      </button>
      {open && (
        <div className="mt-3">
          <DateGroups items={items} />
        </div>
      )}
    </div>
  );
}

/** The newest few, then "Show older (N)" which opens in place into collapsed month headers. */
export default function WhatsNewList({ items }: { items: ListItem[] }) {
  const { recent, older } = splitRecent(items);
  const [showOlder, setShowOlder] = useState(false);
  return (
    <div>
      <DateGroups items={recent} />
      {older.length > 0 &&
        (showOlder ? (
          groupByMonth(older).map((m) => <MonthGroup key={m.month} label={m.label} items={m.items} />)
        ) : (
          <button
            type="button"
            onClick={() => setShowOlder(true)}
            className="rounded-lg border border-gold/40 px-4 py-2 text-[13.5px] font-medium text-gold transition-colors hover:border-gold hover:bg-gold/10"
          >
            Show older ({older.length})
          </button>
        ))}
    </div>
  );
}
