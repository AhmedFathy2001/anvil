import type { Metadata } from 'next';

import ClanLink from '@/components/ClanLink';
import EventApiHost from '@/components/EventApiHost';
import EventPageHeader from '@/components/events/EventPageHeader';
import { verifyUser } from '@/lib/auth';
import { clanHref } from '@/lib/clanPath';
import { requireEventForParticipantPage } from '@/lib/eventScope';
import { liveAccess } from '@/lib/liveData';
import { LIVE_NO_ACCESS } from '@/lib/liveView';
import LiveClient from './LiveClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Feed & chat', robots: { index: false } };

/**
 * A board's Feed and chat on the website, for players on a phone or away from the game: the plugin
 * panel's Feed tab (drops, pets, finished tiles, deaths, milestones) and its chat (My team | All
 * teams | Announcements). A line sent here reaches everyone in game exactly like one sent from the
 * plugin (lib/liveData). Only for the board's players and the host's staff (lib/eventChat chatAccess).
 */
export default async function EventLivePage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const id = parseInt((await params).eventId, 10);
  const { tab } = await searchParams;
  const { event, apiPrefix } = await requireEventForParticipantPage(id);
  const session = await verifyUser();
  const live = session ? await liveAccess(id, session.userId) : null;
  const member = !!live?.access?.member;

  return (
    <div className="mx-auto max-w-3xl">
      <EventApiHost eventId={id} prefix={apiPrefix} />
      <EventPageHeader event={event} apiPrefix={apiPrefix} active="live" title="Feed & chat" access={live?.access ?? null} />
      {member && live ? (
        <LiveClient
          eventId={id}
          initialTab={tab === 'chat' ? 'chat' : 'feed'}
          seats={live.seats.length > 1 ? live.seats : []}
          chatOpen={!!live.access?.open}
        />
      ) : (
        <div className="rounded-xl border border-dashed border-card-border bg-card-bg px-5 py-10 text-center">
          <p className="font-semibold">{LIVE_NO_ACCESS}</p>
          {!session && (
            <ClanLink
              href={`/login?return=${encodeURIComponent(await clanHref(`/events/${id}/live`))}`}
              className="mt-4 inline-flex min-h-11 items-center rounded-lg border border-gold/30 bg-gold/10 px-4 text-sm font-semibold text-gold transition-colors hover:bg-gold/20"
            >
              Sign in with Discord
            </ClanLink>
          )}
        </div>
      )}
    </div>
  );
}
