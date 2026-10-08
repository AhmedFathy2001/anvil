import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { events } from '@/db/schema';
import { requireEventForParticipantPage } from '@/lib/eventScope';
import { requireClan } from '@/lib/clanContext';
import { verifyUser } from '@/lib/auth';
import { atLeast } from '@/lib/clanRoles';
import { clanRoleOnEvent } from '@/lib/eventDiscord';
import EventApiHost from '@/components/EventApiHost';
import ClanLink from '@/components/ClanLink';
import EventDiscordServerPanel from '@/components/EventDiscordServerPanel';
import DiscordJoinClient from './DiscordJoinClient';

export const dynamic = 'force-dynamic';

/**
 * A player's way into their event's Discord server — the page the bot's DM points at, on the player's
 * own clan's address. The invite and the verification code live here, behind their sign-in, and
 * nowhere else.
 *
 * A co-host's admins also manage their side of the event server from here, at their own address.
 */
export default async function EventDiscordPage({ params }: { params: Promise<{ eventId: string }> }) {
  const id = parseInt((await params).eventId, 10);
  const { apiPrefix } = await requireEventForParticipantPage(id);
  // clan-scope: global -- requireEventForParticipantPage settled access above.
  const event = await db.query.events.findFirst({ where: eq(events.id, id), columns: { id: true, name: true } });
  if (!event) notFound();

  const [session, clan] = await Promise.all([verifyUser(), requireClan()]);
  // The role is the ADDRESSED clan's, and so is the panel's every call — host or co-host, each acts
  // as itself.
  const showAdmin = !!session && atLeast(session.role, 'admin') && !!(await clanRoleOnEvent(id, clan.id));
  const returnTo = `/events/${id}/discord`;

  return (
    <div className="mx-auto max-w-xl">
      <EventApiHost eventId={id} prefix={apiPrefix} />
      <ClanLink href={`/events/${id}`} className="text-sm text-text-muted transition-colors hover:text-gold">
        ← {event.name}
      </ClanLink>
      <h1 className="mt-1 mb-6 text-2xl font-bold text-gold">Event Discord</h1>

      {session ? (
        <DiscordJoinClient eventId={id} returnTo={returnTo} />
      ) : (
        <div className="rounded-xl border border-card-border bg-card-bg p-6 text-center">
          <p className="mb-3">Sign in with Discord to see your event server and your verification code.</p>
          <ClanLink href={`/login?return=${encodeURIComponent(returnTo)}`} className="text-gold underline">
            Sign in
          </ClanLink>
        </div>
      )}

      {showAdmin && (
        <div className="mt-10">
          <EventDiscordServerPanel eventId={id} />
        </div>
      )}
    </div>
  );
}
