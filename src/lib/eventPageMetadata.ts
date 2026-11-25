import type { Metadata } from 'next';
import { currentClan, clanPrefix } from '@/lib/clanContext';
import { canSeeEvent } from '@/lib/eventAccess';
import { getClanDisplayName } from '@/lib/pluginConfig';
import { canonicalPathFor, socialMetadata } from '@/lib/seo';
import { eventLinkDescription, eventPageWords, timeLeft, type EventLinkPage } from '@/lib/linkText';
import { eventInClan } from '@/lib/eventScope';
import { verifyUser } from '@/lib/auth';
import { getTeamStandings } from '@/lib/statStandings';
import { standingsHidden } from '@/lib/standingsVisibility';
import { signupWindowState } from '@/lib/signup';
import { eventStage } from '@/lib/eventStage';

/**
 * generateMetadata for any page under /events/<id>. Says nothing (the layout's clan card stands)
 * for an event this visitor may not see, exactly like the event page always has.
 */
export async function eventPageMetadata(eventIdParam: string, page: EventLinkPage = 'event'): Promise<Metadata> {
  const clan = await currentClan();
  const id = Number(eventIdParam);
  if (!clan || !Number.isInteger(id)) return {};

  const event = await eventInClan(clan.id, id);
  const session = await verifyUser();
  if (!event || !(await canSeeEvent({ eventId: id, playerId: session?.playerId ?? null }))) return {};

  // A link card is as public as it gets: while the standings are hidden it names no leader.
  const curtained = standingsHidden(event);
  const [clanName, prefix, standings] = await Promise.all([
    getClanDisplayName(clan.id, clan.name),
    clanPrefix(),
    curtained ? Promise.resolve([]) : getTeamStandings(id, event.scoringMode),
  ]);
  const base = eventLinkDescription(event, standings, Date.now(), { standingsHidden: curtained });
  const window = page === 'signup' ? signupWindowState({ ...event, hostKind: clan.kind }) : null;
  const words = eventPageWords(page, event.name, clanName || clan.name, base, {
    signupOpen: window?.open,
    signupCloses: window?.open ? timeLeft(event.signupDeadline) : null,
    finished: eventStage(event) === 'wrap',
  });

  // Invite links carry a token: never index them, and point the canonical at the sign-up page.
  const path = page === 'event' ? `/events/${id}` : page === 'invite' ? `/events/${id}/signup` : `/events/${id}/${page}`;
  return socialMetadata({
    ...words,
    canonical: canonicalPathFor({ prefix, pathname: path, clanSlug: clan.slug, clanKind: clan.kind }),
    image: `/api/og/event/${id}`,
    noIndex: page === 'invite' || page === 'live' || page === 'signup',
  });
}
