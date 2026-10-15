import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import ClanLink from '@/components/ClanLink';
import EventApiHost from '@/components/EventApiHost';
import { teamCardLine } from '@/lib/eventWrappedRules';
import CopyLink from '../../CopyLink';
import { CardImage, Notice, TeamFacts } from '../../parts';
import { loadWrappedPage, wrappedMetadata } from '../../load';

export const dynamic = 'force-dynamic';

type Params = { eventId: string; teamId: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const p = await params;
  const teamId = Number(p.teamId);
  return wrappedMetadata(Number(p.eventId), (event, w) => {
    const team = w.teams.find((t) => t.id === teamId);
    if (!team) return null;
    return {
      title: `${team.name} — ${event.name} Wrapped`,
      description: teamCardLine(team),
      path: `/events/${event.id}/wrapped/t/${team.id}`,
      image: `/api/og/wrapped/${event.id}/t/${team.id}`,
    };
  });
}

export default async function TeamWrappedPage({ params }: { params: Promise<Params> }) {
  const p = await params;
  const id = parseInt(p.eventId, 10);
  const teamId = Number(p.teamId);
  const { event, apiPrefix, open, preview, isPublic, wrapped } = await loadWrappedPage(id);

  const back = (
    <>
      <EventApiHost eventId={id} prefix={apiPrefix} />
      <ClanLink href={`/events/${id}/wrapped`} className="text-sm text-text-muted hover:text-gold transition-colors">← {event.name} Wrapped</ClanLink>
    </>
  );
  if (!open) {
    return (
      <div>{back}
        <Notice title="Cards aren’t out yet">Every team gets one when the event ends. Check back then.</Notice>
      </div>
    );
  }

  const team = wrapped?.teams.find((t) => t.id === teamId);
  if (!team) notFound();

  return (
    <div className="space-y-6">
      <div>
        {back}
        <h1 className="text-2xl font-bold mt-1 flex items-center gap-3">
          <span className="h-6 w-1.5 rounded-full" style={{ background: team.color }} />
          <span className="text-gold">{team.name}</span>
        </h1>
        <p className="text-sm text-text-muted mt-1">{teamCardLine(team)}</p>
        {preview && <p className="text-xs text-gold mt-2">Staff preview — players see this once the event ends.</p>}
      </div>

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr] items-start">
        <div className="space-y-3">
          {isPublic && <CardImage src={`/api/og/wrapped/${id}/t/${team.id}`} alt={`${team.name}'s Wrapped card`} />}
          <div className="flex flex-wrap items-center gap-3">
            <CopyLink />
            <span className="text-xs text-text-muted">
              {isPublic
                ? 'Paste it in Discord and it shows as this card.'
                : 'This event is private, so the link opens for people who can see it and previews as a plain Anvil card.'}
            </span>
          </div>
        </div>
        <TeamFacts t={team} />
      </div>
    </div>
  );
}
