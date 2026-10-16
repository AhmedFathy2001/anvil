import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { events as eventsTable } from '@/db/schema';
import { resolveClanById } from '@/lib/clanContext';
import { clanVisibilityOf } from '@/lib/clanVisibility';
import { ourImageAsDataUrl } from '@/lib/crestImage';
import { visibilityOf } from '@/lib/eventVisibility';
import { getEventWrapped, wrappedPlayerFor } from '@/lib/eventWrapped';
import {
  cardFeature,
  luckLine,
  nearMisses,
  playerCardLine,
  playerCardStats,
  teamCardLine,
  teamCardStats,
} from '@/lib/eventWrappedRules';
import { siteCard, wrappedCard } from '@/lib/ogCard';
import { cachedCard, remoteSprite, showingAccounts } from '@/lib/ogKit';
import { getClanDisplayName } from '@/lib/pluginConfig';
import { isEventEnded } from '@/lib/survey';

export const dynamic = 'force-dynamic';

type Params = { eventId: string; kind: string; id: string };

/**
 * A player's or a team's Wrapped card — the picture their share link unfurls into.
 *
 * Same read gate as the event's own card (api/og/event): an `invited` event, or any event of a clan
 * that keeps to itself, draws the plain Anvil card, never a 404, so the link can't be used to ask
 * which private events exist. And nothing before the event ends: Wrapped is a look back.
 */
async function load(_request: Request, { params }: { params: Promise<Params> }): Promise<Response> {
  const p = await params;
  const eventId = Number(p.eventId);
  const id = Number(p.id);
  if (!Number.isInteger(eventId) || eventId <= 0 || !Number.isInteger(id) || id <= 0) return siteCard();
  if (p.kind !== 'p' && p.kind !== 't') return siteCard();

  // clan-scope: global -- reads the very event named in the URL, by its own id; its clan is resolved and access-checked next.
  const event = await db.query.events.findFirst({ where: eq(eventsTable.id, eventId) });
  if (!event || visibilityOf(event.visibility) === 'invited' || !isEventEnded(event)) return siteCard();
  const clan = await resolveClanById(event.clanId);
  if (!clan || clanVisibilityOf(clan.visibility) !== 'public') return siteCard();

  const wrapped = await getEventWrapped(eventId);
  if (!wrapped) return siteCard();

  const [clanName, clanLogo] = await Promise.all([
    getClanDisplayName(clan.id, clan.name),
    ourImageAsDataUrl(clan.logoUrl, { width: 300, height: 300 }, 'png'),
  ]);
  const base = { eventName: event.name, clanName: clanName || clan.name, clanLogo };

  if (p.kind === 't') {
    const team = wrapped.teams.find((t) => t.id === id);
    if (!team) return siteCard();
    const feature = cardFeature(team);
    return wrappedCard({
      ...base,
      name: team.name,
      accent: team.color,
      line: teamCardLine(team),
      stats: teamCardStats(team),
      feature: feature && { ...feature, sprite: await remoteSprite(feature.image, 150) },
      awards: team.awards.map((a) => a.title),
      luck: null,
    });
  }

  const player = wrappedPlayerFor(wrapped, id);
  if (!player) return siteCard();
  const feature = cardFeature(player);
  const res = await wrappedCard({
    ...base,
    name: player.name,
    accent: player.team?.color ?? null,
    line: playerCardLine(player),
    stats: playerCardStats(player),
    feature: feature && { ...feature, sprite: await remoteSprite(feature.image, 150) },
    awards: player.awards.map((a) => a.title),
    nearMisses: nearMisses(player),
    luck: luckLine(player),
  });
  const accounts = player.playerIds.map((pid) => wrapped.accountOf[pid]).filter((a): a is number => a != null);
  return showingAccounts(res, accounts);
}

export function GET(request: Request, ctx: { params: Promise<Params> }) {
  return cachedCard(new URL(request.url).pathname, () => load(request, ctx));
}
