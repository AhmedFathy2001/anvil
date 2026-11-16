import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { clans, events, teamInvites, teams } from '@/db/schema';
import { parseLoginTarget } from '@/lib/loginTarget';

/**
 * The one line /login shows above its button when it knows why the person is signing in, or null
 * for a bare sign-in. Names come from public rows only: an event is named only when it is not invite-only
 * and its clan is public (a 'clan' event on a public clan is readable by anyone, as its own page is); anything else gets the generic wording for the same reason.
 * Never a person's name.
 */
export async function loginReason(returnTo: string): Promise<string | null> {
  const target = parseLoginTarget(returnTo);
  try {
    switch (target.kind) {
      case 'new-clan':
        return 'Sign in to create your clan.';
      case 'device':
        return 'Sign in to connect the Anvil plugin.';
      case 'clan': {
        // clan-scope: global -- reads one public clan row by its slug, for a sentence.
        const clan = await db.query.clans.findFirst({
          where: eq(clans.slug, target.slug),
          columns: { name: true, visibility: true, platformHidden: true, kind: true },
        });
        if (!clan || clan.visibility !== 'public' || clan.platformHidden) return null;
        return clan.kind === 'creator' ? `Sign in to join ${clan.name}.` : `Sign in to apply to ${clan.name}.`;
      }
      case 'event-signup':
      case 'invite': {
        // clan-scope: global -- the event is named by id; visibility is checked below.
        const event = await db.query.events.findFirst({
          where: eq(events.id, target.eventId),
          columns: { name: true, visibility: true, clanId: true },
        });
        const clan = event
          ? await db.query.clans.findFirst({ where: eq(clans.id, event.clanId), columns: { visibility: true, platformHidden: true } })
          : null;
        const nameable = !!event && event.visibility !== 'invited' && clan?.visibility === 'public' && !clan.platformHidden;
        if (target.kind === 'event-signup') return nameable ? `Sign in to sign up for ${event!.name}.` : 'Sign in to sign up for this event.';
        if (!nameable) return 'You’re invited to join a team. Sign in to accept.';
        const invite = await db.query.teamInvites.findFirst({ where: eq(teamInvites.token, target.token), columns: { teamId: true } });
        const team = invite ? await db.query.teams.findFirst({ where: eq(teams.id, invite.teamId), columns: { name: true, eventId: true } }) : null;
        return team && team.eventId === target.eventId
          ? `You’re invited to join ${team.name} in ${event!.name}.`
          : `You’re invited to ${event!.name}.`;
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}
