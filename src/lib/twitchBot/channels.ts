import { and, eq } from 'drizzle-orm';

import { db } from '@/db';
import { clans, events, settings } from '@/db/schema';
import { canSeeEvent } from '@/lib/eventAccess';
import { absoluteUrl } from '@/lib/seo';

import { CHAT_JOIN_SETTING, NOTHING_OPEN_REPLY, joinReplyText, pickJoinEvent } from './wire';

// `!join` — the site's half (the bot process is bot/twitchChat.ts; shared rules in ./wire).
//
// WHICH CHANNEL IS WHOSE. The bot may only ever talk in a channel whose broadcaster PROVED it is
// theirs. The Twitch link on a creator's settings page is typed text — anybody can paste anybody's
// channel — so it is never used for this. The proof is the creator's linked Twitch account, which the
// entry-gates work (branch feat/creator-entry-gates) adds via Twitch OAuth. Until that lands,
// linkedTwitchBroadcaster answers null and the bot has no channels: it runs, and says nothing.

export interface TwitchBroadcaster {
  /** Twitch user id (decimal string) — what EventSub and Send Chat Message take. */
  id: string;
  login: string;
}

/**
 * The Twitch channel a creator space has PROVED it owns, or null.
 *
 * TODO(feat/creator-entry-gates): read the space's linked Twitch account from wherever Twitch account
 * linking stores it (the space owner's verified Twitch user id + login). Requirements on that link:
 *   - it came from Twitch OAuth (never from the typed creator_twitch_url setting);
 *   - it is the account of a person who is admin/owner of THIS space (clanId);
 *   - unlinking it makes this return null again (the bot drops the channel on its next refresh).
 * If linking also asks the broadcaster for the `channel:bot` scope, the bot can later send with an
 * app token and wear Twitch's "Chat Bot" badge — see bot/twitchChat.ts. Nothing else here changes.
 */
export async function linkedTwitchBroadcaster(clanId: number): Promise<TwitchBroadcaster | null> {
  void clanId;
  return null;
}

/** Is `!join` switched on for this space? The host's opt-in on Admin → Space settings. */
export async function chatJoinEnabled(clanId: number): Promise<boolean> {
  // clan-scope: this clan -- the space's own setting row.
  const row = await db.query.settings.findFirst({ where: and(eq(settings.clanId, clanId), eq(settings.key, CHAT_JOIN_SETTING)) });
  return row?.value === 'on';
}

/** Every channel the bot should be in: an active creator space, switched on, with a proved channel. */
export async function chatBotChannels(): Promise<{ clanId: number; broadcaster: TwitchBroadcaster }[]> {
  // clan-scope: global -- the bot serves every creator space that opted in; each row is its own clan's.
  const rows = await db
    .select({ clanId: clans.id })
    .from(settings)
    .innerJoin(clans, eq(clans.id, settings.clanId))
    .where(and(eq(settings.key, CHAT_JOIN_SETTING), eq(settings.value, 'on'), eq(clans.kind, 'creator'), eq(clans.status, 'active')));
  const out: { clanId: number; broadcaster: TwitchBroadcaster }[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const b = await linkedTwitchBroadcaster(r.clanId);
    // One channel answers for one space: a channel two spaces both claim is answered by neither.
    if (!b) continue;
    if (seen.has(b.id)) {
      const i = out.findIndex((o) => o.broadcaster.id === b.id);
      if (i >= 0) out.splice(i, 1);
      continue;
    }
    seen.add(b.id);
    out.push({ clanId: r.clanId, broadcaster: b });
  }
  return out;
}

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

/** What the bot says to `!join` in this broadcaster's channel, or null to stay quiet. */
export async function joinReplyForBroadcaster(broadcasterId: string): Promise<string | null> {
  const channel = (await chatBotChannels()).find((c) => c.broadcaster.id === broadcasterId);
  if (!channel) return null;
  const event = await joinEventFor(channel.clanId);
  return event ? joinReplyText(event.name, event.url) : NOTHING_OPEN_REPLY;
}
