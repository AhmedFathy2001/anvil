import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import ClanLink from '@/components/ClanLink';
import EventApiHost from '@/components/EventApiHost';
import { viewerPlayerIds, wrappedPlayerFor, wrappedPlayerKey } from '@/lib/eventWrapped';
import { playerCardLine, playerCardStats } from '@/lib/eventWrappedRules';
import CopyLink from '../../CopyLink';
import { CardImage, Notice, PlayerFacts } from '../../parts';
import { loadWrappedPage, wrappedMetadata } from '../../load';

export const dynamic = 'force-dynamic';

type Params = { eventId: string; playerId: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const p = await params;
  const playerId = Number(p.playerId);
  return wrappedMetadata(Number(p.eventId), (event, w) => {
    const player = Number.isInteger(playerId) ? wrappedPlayerFor(w, playerId) : null;
    if (!player) return null;
    const key = wrappedPlayerKey(player);
    const facts = playerCardStats(player).map((s) => `${s.value} ${s.label.toLowerCase()}`);
    return {
      title: `${player.name} — ${event.name} Wrapped`,
      description: [playerCardLine(player), ...facts].filter(Boolean).join(' · '),
      path: `/events/${event.id}/wrapped/p/${key}`,
      image: `/api/og/wrapped/${event.id}/p/${key}`,
    };
  });
}

export default async function PlayerWrappedPage({ params }: { params: Promise<Params> }) {
  const p = await params;
  const id = parseInt(p.eventId, 10);
  const playerId = Number(p.playerId);
  const { event, apiPrefix, open, preview, isPublic, wrapped, viewerPlayerId } = await loadWrappedPage(id);

  const back = (
    <>
      <EventApiHost eventId={id} prefix={apiPrefix} />
      <ClanLink href={`/events/${id}/wrapped`} className="text-sm text-text-muted hover:text-gold transition-colors">← {event.name} Wrapped</ClanLink>
    </>
  );
  if (!open) {
    return (
      <div>{back}
        <Notice title="Cards aren’t out yet">Everyone gets theirs when the event ends. Check back then.</Notice>
      </div>
    );
  }

  const player = wrapped && Number.isInteger(playerId) ? wrappedPlayerFor(wrapped, playerId) : null;
  if (!player) notFound();
  const isMine = (await viewerPlayerIds(id, viewerPlayerId)).some((pid) => player.playerIds.includes(pid));

  return (
    <div className="space-y-6">
      <div>
        {back}
        <h1 className="text-2xl font-bold text-gold mt-1">{player.name}</h1>
        {playerCardLine(player) && <p className="text-sm text-text-muted mt-1">{playerCardLine(player)}</p>}
        {preview && <p className="text-xs text-gold mt-2">Staff preview — players see this once the event ends.</p>}
      </div>

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr] items-start">
        <div className="space-y-3">
          {isPublic && <CardImage src={`/api/og/wrapped/${id}/p/${wrappedPlayerKey(player)}`} alt={`${player.name}'s Wrapped card`} />}
          <div className="flex flex-wrap items-center gap-3">
            <CopyLink label={isMine ? 'Copy link to your card' : 'Copy link'} />
            <span className="text-xs text-text-muted">
              {isPublic
                ? 'Paste it in Discord and it shows as this card.'
                : 'This event is private, so the link opens for people who can see it and previews as a plain Anvil card.'}
            </span>
          </div>
        </div>
        <PlayerFacts p={player} />
      </div>
    </div>
  );
}
