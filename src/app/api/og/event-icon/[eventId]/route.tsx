import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { events } from '@/db/schema';
import { resolveClanById } from '@/lib/clanContext';
import { clanMark } from '@/lib/crestImage';
import { eventIconUrl } from '@/lib/eventImage';

export const dynamic = 'force-dynamic';

/**
 * An event's mark for a Discord embed: its icon, else its host clan's logo, else the crest — as the
 * same 128px PNG the clan mark is (lib/crestImage clanMark), since Discord won't show every format an
 * upload can be. Embeds of private events point here too (they're posted into private servers), so
 * the only thing this serves is a picture its own admins chose to put on Discord posts.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const id = Number((await params).eventId);
  // clan-scope: global -- the event named in the URL, by id; only its picture is served.
  const event = Number.isInteger(id) && id > 0
    ? await db.query.events.findFirst({ where: eq(events.id, id), columns: { name: true, clanId: true, iconUrl: true } })
    : undefined;
  if (!event) return clanMark('Anvil', null);
  const clan = await resolveClanById(event.clanId);
  return clanMark(clan?.name ?? event.name, eventIconUrl(event, clan));
}
