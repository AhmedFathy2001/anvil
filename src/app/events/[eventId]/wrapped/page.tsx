import type { Metadata } from 'next';

import ClanLink from '@/components/ClanLink';
import EventApiHost from '@/components/EventApiHost';
import { viewerPlayerIds, wrappedPlayerFor, wrappedPlayerKey } from '@/lib/eventWrapped';
import { playerCardLine } from '@/lib/eventWrappedRules';
import { CardImage, Notice, PlayerFacts } from './parts';
import { loadWrappedPage, wrappedMetadata } from './load';
import PlayerList from './PlayerList';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ eventId: string }> }): Promise<Metadata> {
  const id = Number((await params).eventId);
  return wrappedMetadata(id, (event, w) => {
    const top = w.teams.find((t) => t.members > 1);
    return {
      title: `${event.name} Wrapped`,
      description: `Every player's and every team's event, on one card each.${top && top.rank === 1 && top.of > 1 ? ` ${top.name} took 1st.` : ''}`,
      path: `/events/${event.id}/wrapped`,
      image: top ? `/api/og/wrapped/${event.id}/t/${top.id}` : `/api/og/event/${event.id}`,
    };
  });
}

/**
 * Wrapped: the link the end-of-event post carries. Signed in and played → your card first, with its
 * share link a click away; everyone can browse every team's and every player's card below.
 */
export default async function WrappedPage({ params }: { params: Promise<{ eventId: string }> }) {
  const id = parseInt((await params).eventId, 10);
  const { event, apiPrefix, open, preview, isPublic, wrapped, viewerPlayerId } = await loadWrappedPage(id);

  const header = (
    <div className="mb-6">
      <EventApiHost eventId={id} prefix={apiPrefix} />
      <ClanLink href={`/events/${id}`} className="text-sm text-text-muted hover:text-gold transition-colors">← {event.name}</ClanLink>
      <h1 className="text-2xl font-bold text-gold mt-1">Wrapped</h1>
      <p className="text-sm text-text-muted mt-1">Everyone&rsquo;s event on one card. Open yours and copy its link: it shows as the card in Discord.</p>
      {preview && <p className="text-xs text-gold mt-2">Staff preview — players see this once the event ends.</p>}
    </div>
  );

  if (!open) {
    return (
      <div>{header}
        <Notice title="Cards aren’t out yet">Everyone gets theirs when the event ends. Check back then.</Notice>
      </div>
    );
  }
  // Teams of one are people; their cards are already in the player list.
  const realTeams = (wrapped?.teams ?? []).filter((t) => t.members > 1);
  if (!wrapped || (wrapped.players.length === 0 && realTeams.length === 0)) {
    return (
      <div>{header}
        <Notice title="Nothing to wrap">Nobody logged any play during this event, so there are no cards.</Notice>
      </div>
    );
  }

  const mineIds = await viewerPlayerIds(id, viewerPlayerId);
  const mine = mineIds.map((pid) => wrappedPlayerFor(wrapped, pid)).find((p) => p != null) ?? null;

  return (
    <div className="space-y-10">
      {header}

      {mine && (
        <section>
          <h2 className="flex items-center gap-2 text-lg font-semibold mb-3">
            <span className="w-1 h-5 bg-gold" />
            Your card
          </h2>
          <div className="grid gap-6 lg:grid-cols-[3fr_2fr] items-start">
            {isPublic ? (
              <CardImage src={`/api/og/wrapped/${id}/p/${wrappedPlayerKey(mine)}`} alt={`${mine.name}'s Wrapped card`} />
            ) : (
              <PlayerFacts p={mine} />
            )}
            <div className="space-y-3">
              <p className="text-lg font-semibold">{mine.name}</p>
              {playerCardLine(mine) && <p className="text-sm text-text-muted">{playerCardLine(mine)}</p>}
              <ClanLink
                href={`/events/${id}/wrapped/p/${wrappedPlayerKey(mine)}`}
                className="inline-block rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-brown-dark hover:bg-gold/90 transition-colors"
              >
                Open and share your card
              </ClanLink>
            </div>
          </div>
        </section>
      )}

      {realTeams.length > 0 && (
        <section>
          <h2 className="flex items-center gap-2 text-lg font-semibold mb-3">
            <span className="w-1 h-5 bg-gold" />
            Teams
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {realTeams.map((t) => (
              <ClanLink
                key={t.id}
                href={`/events/${id}/wrapped/t/${t.id}`}
                className="flex items-center gap-3 rounded-xl border border-card-border bg-card-bg px-4 py-3 hover:border-gold/60 transition-colors"
              >
                <span className="h-8 w-1 rounded-full shrink-0" style={{ background: t.color }} />
                <span className="min-w-0">
                  <span className="block font-semibold truncate">{t.name}</span>
                  <span className="block text-xs text-text-muted">
                    #{t.rank} · {t.score.toLocaleString()} {t.unit === 'tiles' ? 'tiles' : 'pts'} · {t.members} players
                  </span>
                </span>
              </ClanLink>
            ))}
          </div>
        </section>
      )}

      {wrapped.players.length > 0 && (
        <section>
          <h2 className="flex items-center gap-2 text-lg font-semibold mb-3">
            <span className="w-1 h-5 bg-gold" />
            Players
          </h2>
          <PlayerList
            eventId={id}
            players={[...wrapped.players]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((p) => ({ key: wrappedPlayerKey(p), name: p.name, team: realTeams.length ? p.team?.name ?? null : null, color: p.team?.color ?? null }))}
          />
        </section>
      )}
    </div>
  );
}
