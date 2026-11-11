'use client';

import { useState, type ReactNode } from 'react';
import ClanLink from '@/components/ClanLink';

/**
 * The event's own pages as one tab bar under the hero: Board (this page), Stats, Feed & chat, Rules,
 * and Moderate on the far right for chat staff. Replaces the stack of full-width link rows that pushed
 * the board below the fold. Rules has no page of its own: its tab opens the rules panel under the bar
 * (`rules` is that panel's content). `?rules=1#rules` links (the Discord rules post) open it on load via `rulesOpen`.
 */
export default function EventTabs({
  eventId,
  stats,
  live,
  moderate,
  rules,
  rulesOpen = false,
}: {
  eventId: number;
  stats: boolean;
  live: boolean;
  moderate: boolean;
  rules: ReactNode | null;
  rulesOpen?: boolean;
}) {
  const [open, setOpen] = useState(rulesOpen);
  if (!stats && !live && !moderate && !rules) return null;

  const tab =
    'flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-semibold transition-colors';
  const idle = `${tab} border-transparent text-text-muted hover:text-foreground`;

  return (
    <div id="rules" className="mb-6 scroll-mt-20">
      <nav
        aria-label="Event pages"
        className="flex items-stretch gap-0.5 overflow-x-auto border-b border-card-border [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <span className={`${tab} ${open ? 'border-transparent text-foreground' : 'border-gold text-gold'}`} aria-current="page">
          <Icon d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />
          Board
        </span>
        {stats && (
          <ClanLink href={`/events/${eventId}/stats`} className={idle}>
            <Icon d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
            Stats
          </ClanLink>
        )}
        {live && (
          <ClanLink href={`/events/${eventId}/live`} className={idle}>
            <Icon d="M4 5h16v11H9l-5 4z" />
            Feed &amp; chat
          </ClanLink>
        )}
        {rules && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="event-rules-panel"
            className={open ? `${tab} border-gold text-gold` : idle}
          >
            <Icon d="M4 6h16M4 12h10M4 18h7" />
            Rules
          </button>
        )}
        {moderate && (
          <ClanLink
            href={`/events/${eventId}/chat`}
            title="Staff only: delete messages, time out or ban players, pause the chat"
            className={`${tab} ml-auto border-transparent text-sky-300/80 hover:text-sky-200`}
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
