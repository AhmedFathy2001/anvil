// Fan-out of one event's posts to its extra webhooks (event_webhooks). Called from the one choke
// point every event post goes through (lib/discord sendEventBingoWebhook), after the host and the
// co-hosts — an extra hook can't delay or break the channels the clan already relies on.

import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { eventWebhooks } from '@/db/schema';
import { hookWants, parseEventPostKinds, type EventPostKind } from '@/lib/eventWebhookKinds';

export interface EventHookTarget {
  id: number;
  url: string;
}

/** The hooks on `eventId` that want this post. */
export async function eventHookTargets(
  eventId: number,
  post: { kind: EventPostKind; teamId?: number | null },
): Promise<EventHookTarget[]> {
  const rows = await db
    .select({ id: eventWebhooks.id, url: eventWebhooks.url, teamId: eventWebhooks.teamId, kinds: eventWebhooks.kinds })
    .from(eventWebhooks)
    .where(eq(eventWebhooks.eventId, eventId));
  return rows
    .filter((r) => hookWants({ teamId: r.teamId, kinds: parseEventPostKinds(r.kinds) }, post))
    .map((r) => ({ id: r.id, url: r.url }));
}
