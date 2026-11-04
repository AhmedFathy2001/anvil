import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { clans, events } from '@/db/schema';
import { canSeeEvent } from '@/lib/eventAccess';
import { absoluteUrl } from '@/lib/seo';
import { NOTHING_OPEN_REPLY, joinReplyText, pickJoinEvent } from '@/lib/twitchBot/wire';

// `!join` — the platform-neutral half. Whichever chat asked (Twitch through bot/twitchChat.ts, Kick
// through its webhook), the answer for a creator space is the same: its open event's link. The
// pure rules (which event, the words, the rate limiter) are in lib/twitchBot/wire, which the Twitch
// bot process also loads under Node's type stripping and so cannot move.

/**
 * The open event a space's `!join` points at, with its link — or null.
 *
 * Only events a signed-out stranger can already see (canSeeEvent with no player): the reply goes to a
 * public chat, so it may name nothing the event page would not show that chat anyway.
 */
export async function joinEventFor(clanId: number, now = Date.now()): Promise<{ id: number; name: string; url: string } | null> {
  // clan-scope: this clan -- the space's own events.
  const rows = await db
    .select({
      id: events.id,
      name: events.name,
      startDate: events.startDate,
      endDate: events.endDate,
      forceEndedAt: events.forceEndedAt,
      signupDeadline: events.signupDeadline,
    })
    .from(events)
    .where(eq(events.clanId, clanId));
  const visible = [];
  for (const r of rows) if (await canSeeEvent({ eventId: r.id, playerId: null })) visible.push(r);
  const pick = pickJoinEvent(visible, now);
  if (!pick) return null;
  // clan-scope: this clan -- the slug of the space whose event this is.
  const clan = await db.query.clans.findFirst({ where: eq(clans.id, clanId), columns: { slug: true } });
  if (!clan) return null;
  return { id: pick.id, name: pick.name, url: absoluteUrl(`/c/${clan.slug}/events/${pick.id}`) };
}

/** What `!join` says for this space, on any platform. */
export async function joinReplyForClan(clanId: number): Promise<string> {
  const event = await joinEventFor(clanId);
  return event ? joinReplyText(event.name, event.url) : NOTHING_OPEN_REPLY;
}
