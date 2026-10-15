import type { Metadata } from 'next';

import { clanPrefix, currentClan } from '@/lib/clanContext';
import { atLeast } from '@/lib/clanRoles';
import { verifyUser } from '@/lib/auth';
import { canSeeEvent } from '@/lib/eventAccess';
import { eventInClan, requireEventForParticipantPage } from '@/lib/eventScope';
import { getEventWrapped, wrappedCardIsPublic, type EventWrapped } from '@/lib/eventWrapped';
import { canonicalPathFor, socialMetadata } from '@/lib/seo';
import { isEventEnded } from '@/lib/survey';

/**
 * What every Wrapped page needs: the event (through the participant gate, so a private event 404s
 * here exactly as its board does), whether its cards are out yet, and the cards.
 *
 * Cards come out when the event ends. Staff of the addressed clan can look early, the way they can
 * preview the recap — a co-host's staff are staff over there, not of this event.
 */
export async function loadWrappedPage(eventId: number): Promise<{
  event: Awaited<ReturnType<typeof requireEventForParticipantPage>>['event'];
  apiPrefix: string | null;
  open: boolean;
  preview: boolean;
  isPublic: boolean;
  wrapped: EventWrapped | null;
  viewerPlayerId: number | null;
}> {
  const { event, apiPrefix } = await requireEventForParticipantPage(eventId);
  const session = await verifyUser();
  const ended = isEventEnded(event);
  const isStaff =
    !apiPrefix && (atLeast(session?.role, 'admin') || session?.role === 'treasurer' || session?.role === 'moderator');
  const open = ended || isStaff;
  const [wrapped, isPublic] = await Promise.all([
    open ? getEventWrapped(eventId) : Promise.resolve(null),
    wrappedCardIsPublic(event),
  ]);
  return { event, apiPrefix, open, preview: !ended && isStaff, isPublic, wrapped, viewerPlayerId: session?.playerId ?? null };
}

/** Link-card metadata for a Wrapped page: its own picture once the event has ended, else nothing. */
export async function wrappedMetadata(
  eventId: number,
  build: (event: { id: number; name: string }, w: EventWrapped) => { title: string; description: string; path: string; image: string } | null,
): Promise<Metadata> {
  const clan = await currentClan();
  if (!clan || !Number.isInteger(eventId)) return {};
  const event = await eventInClan(clan.id, eventId);
  const session = await verifyUser();
  if (!event || !isEventEnded(event) || !(await canSeeEvent({ eventId, playerId: session?.playerId ?? null }))) return {};
  const wrapped = await getEventWrapped(eventId);
  if (!wrapped) return {};
  const meta = build(event, wrapped);
  if (!meta) return {};
  const prefix = await clanPrefix();
  return socialMetadata({
    title: meta.title,
    description: meta.description,
    canonical: canonicalPathFor({ prefix, pathname: meta.path, clanSlug: clan.slug }),
    image: meta.image,
  });
}
