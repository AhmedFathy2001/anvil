import type { ReactNode } from 'react';

import ClanCrest from '@/components/ClanCrest';
import ClanLink from '@/components/ClanLink';
import EventTimer from '@/components/EventTimer';
import { resolveClanById } from '@/lib/clanContext';
import { eventPoolGp } from '@/lib/coffer';
import { eventIconUrl } from '@/lib/eventImage';
import { computePrizePool, countPaidEntries } from '@/lib/prizePool';
import EventTabs from '@/components/events/EventTabs';
import { verifyUser } from '@/lib/auth';
import type { ChatAccess } from '@/lib/eventChat';
import type { ScopedEvent } from '@/lib/eventScope';
import { eventTabsFor } from '@/lib/eventTabs';

/**
 * The top of an event's own pages (Stats, Feed & chat, Moderate): the event's icon and name (back to
 * its board), its prize pool and clock, and the same tab bar the event page has, with this page's tab lit. `children` is the page's
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
  const [hostClan, paid, cofferFunded] = await Promise.all([resolveClanById(event.clanId), countPaidEntries(event.id), eventPoolGp(event.id)]);
  const prizePool = computePrizePool({ addedPrizePool: event.addedPrizePool, signupFee: event.signupFee, approvedCount: paid.count, paidFeesGp: paid.gp, cofferFunded });
  const tabs = await eventTabsFor(event, { userId: session?.userId ?? null, apiPrefix, active, access, curtained });
  return (
    <header className="mb-5">
      {/* Off the Board tab the banner folds away: the icon carries the event, with the prize and the clock. */}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-2xl border border-card-border bg-card-bg p-4">
        <div className="flex min-w-0 items-center gap-3.5">
          <ClanCrest name={hostClan?.name || event.name} logoUrl={eventIconUrl(event, hostClan)} size={52} rounded="rounded-[14px]" className="shrink-0 text-xl ring-2 ring-gold" />
          <h1 className="min-w-0 break-words text-[22px] font-bold leading-tight text-gold">
            <ClanLink href={`/events/${event.id}`} className="transition-colors hover:text-gold-light">
              {event.name}
            </ClanLink>
            <span className="sr-only"> · {title}</span>
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-foreground/80">
          {prizePool > 0 && (
            <span>
              <b className="text-gold-light tabular-nums">{prizePool.toLocaleString()} gp</b> prize pool
            </span>
          )}
          <EventTimer startDate={event.startDate} endDate={event.endDate} forceEndedAt={event.forceEndedAt} />
        </div>
      </div>
      <div className="mt-3">
        <EventTabs eventId={event.id} active={active} tabs={tabs} hasRules />
      </div>
      {children && <div className="-mt-2 text-sm text-text-muted">{children}</div>}
    </header>
  );
}
