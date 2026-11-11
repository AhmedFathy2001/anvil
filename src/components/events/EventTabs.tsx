'use client';

import { useState, type ReactNode } from 'react';
import ClanLink from '@/components/ClanLink';
import type { EventTabsData } from '@/lib/eventTabs';

type Active = 'board' | 'stats' | 'live' | 'chat';

/**
 * The event's own pages as one tab bar: Board, Stats, Feed & chat, Rules, and Moderate on the far
 * right for chat staff. The same bar sits on the event page and on its Stats, Feed & chat and
 * Moderate pages (which tabs show: lib/eventTabs eventTabsFor), so people move between them.
 *
 * Rules has no page of its own. On the event page (`rules` given) its tab opens the rules panel under
 * the bar; `?rules=1#rules` links (the Discord rules post) open it on load via `rulesOpen`. On the
 * other pages it links to exactly that.
 */
export default function EventTabs({
  eventId,
  active,
  tabs,
  rules = null,
  hasRules = false,
  rulesOpen = false,
}: {
  eventId: number;
  active: Active;
  tabs: EventTabsData;
  /** The rules panel's content: the event page only. */
  rules?: ReactNode | null;
  /** Elsewhere: whether to show a Rules tab linking back to the event page's panel. */
  hasRules?: boolean;
  rulesOpen?: boolean;
}) {
  const [open, setOpen] = useState(rulesOpen);
  const showRules = !!rules || hasRules;
  if (!tabs.stats && !tabs.live && !tabs.moderate && !showRules) return null;

  const tab =
    'flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-semibold transition-colors';
  const on = `${tab} border-gold text-gold`;
  const idle = `${tab} border-transparent text-text-muted hover:text-foreground`;
  const base = `/events/${eventId}`;

  return (
    <div id={rules ? 'rules' : undefined} className="mb-6 scroll-mt-20">
      <nav
        aria-label="Event pages"
        className="flex items-stretch gap-0.5 overflow-x-auto border-b border-card-border [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {active === 'board' ? (
          rules && open ? (
            <button type="button" onClick={() => setOpen(false)} className={idle}>
              <Icon d={BOARD} />
              Board
            </button>
          ) : (
            <span className={on} aria-current="page">
              <Icon d={BOARD} />
              Board
            </span>
          )
        ) : (
          <ClanLink href={base} className={idle}>
            <Icon d={BOARD} />
            Board
          </ClanLink>
        )}
        {tabs.stats && (
          <ClanLink href={`${base}/stats`} className={active === 'stats' ? on : idle} aria-current={active === 'stats' ? 'page' : undefined}>
            <Icon d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
            Stats
          </ClanLink>
        )}
        {tabs.live && (
          <ClanLink href={`${base}/live`} className={active === 'live' ? on : idle} aria-current={active === 'live' ? 'page' : undefined}>
            <Icon d="M4 5h16v11H9l-5 4z" />
            Feed &amp; chat
            {tabs.unread && (
              <span className="h-1.5 w-1.5 rounded-full bg-accent-green-light" role="img" aria-label="new messages" />
            )}
          </ClanLink>
        )}
        {rules ? (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="event-rules-panel"
            className={open ? on : idle}
          >
            <Icon d={RULES} />
            Rules
          </button>
        ) : (
          hasRules && (
            <ClanLink href={`${base}?rules=1#rules`} className={idle}>
              <Icon d={RULES} />
              Rules
            </ClanLink>
          )
        )}
        {tabs.moderate && (
          <ClanLink
            href={`${base}/chat`}
            title="Staff only: delete messages, time out or ban players, pause the chat"
            aria-current={active === 'chat' ? 'page' : undefined}
            className={`${tab} ml-auto ${
              active === 'chat' ? 'border-sky-300 text-sky-200' : 'border-transparent text-sky-300/80 hover:text-sky-200'
            }`}
          >
            <Icon d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
            Moderate
          </ClanLink>
        )}
      </nav>
      {rules && open && (
        <div id="event-rules-panel" className="rounded-b-xl border border-t-0 border-card-border bg-card-bg p-4">
          {rules}
        </div>
      )}
    </div>
  );
}

const BOARD = 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z';
const RULES = 'M4 6h16M4 12h10M4 18h7';

function Icon({ d }: { d: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="h-4 w-4 fill-none stroke-current"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  );
}
