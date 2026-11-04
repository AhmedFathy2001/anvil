import { count, eq } from 'drizzle-orm';

import { db } from '@/db';
import { events } from '@/db/schema';
import { requireClan } from '@/lib/clanContext';
import { suggestEventName } from '@/lib/eventPresets';
import { isCreatorSpace } from '@/lib/creatorSpaces';
import FirstEventClient from './FirstEventClient';

export const dynamic = 'force-dynamic';

/**
 * The quick event screen — where "Host an event" lands (lib/creatorSpaces). A name, the dates and
 * one of three big format cards; everything else stays on its default, and the full wizard is one
 * "More options" link away. Works in any clan, but is written for somebody who has never used Anvil.
 */
export default async function FirstEventPage() {
  const clan = await requireClan();
  // clan-scope: this clan's own events, for the suggested name's number.
  const [ec] = await db.select({ c: count() }).from(events).where(eq(events.clanId, clan.id));
  return (
    <FirstEventClient
      suggestedName={suggestEventName(clan.name, ec?.c ?? 0)}
      first={(ec?.c ?? 0) === 0}
      creator={isCreatorSpace(clan)}
    />
  );
}
