import type { ReactNode } from 'react';

import ClanLink from '@/components/ClanLink';
import EventTabs from '@/components/events/EventTabs';
import { verifyUser } from '@/lib/auth';
import type { ChatAccess } from '@/lib/eventChat';
import type { ScopedEvent } from '@/lib/eventScope';
import { eventTabsFor } from '@/lib/eventTabs';

/**
 * The top of an event's own pages (Stats, Feed & chat, Moderate): the event's name, back to its
 * board, and the same tab bar the event page has, with this page's tab lit. `children` is the page's
 * own line under the bar, if it has one.
 */
export default async function EventPageHeader({
  event,
  apiPrefix,
  active,
  title,
  access,
  curtained,
  children,
}: {
  event: ScopedEvent;
  apiPrefix: string | null;
  active: 'stats' | 'live' | 'chat';
  /** The page's name, for screen readers: the lit tab says it to everyone else. */
  title: string;
  access?: ChatAccess | null;
  curtained?: boolean;
  children?: ReactNode;
}) {
  const session = await verifyUser();
  const tabs = await eventTabsFor(event, { userId: session?.userId ?? null, apiPrefix, active, access, curtained });
  return (
    <header className="mb-5">
      <h1 className="text-2xl font-bold text-gold">
        <ClanLink href={`/events/${event.id}`} className="transition-colors hover:text-gold-light">
          {event.name}
        </ClanLink>
        <span className="sr-only"> · {title}</span>
      </h1>
      <div className="mt-3">
        <EventTabs eventId={event.id} active={active} tabs={tabs} hasRules />
      </div>
      {children && <div className="-mt-2 text-sm text-text-muted">{children}</div>}
    </header>
  );
}
