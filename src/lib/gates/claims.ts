// One platform account, one player per event — for gates other than Twitch (which keeps its own
// event_twitch_claims). The same rules as lib/entryGatesDb claimTwitchForEvent, on event_gate_claims
// keyed by (event, platform, platform user id). Read that function's comment for why each step is
// there; this is the same algorithm, parameterised by platform.

import { and, eq } from 'drizzle-orm';

import { db } from '@/db';
import { eventGateClaims } from '@/db/schema';
import { parseStamp } from '@/lib/dbTime';
import { CLAIM_HOLD_MS, liveInEvent } from '@/lib/entryGatesDb';

export type ClaimPlatform = 'kick' | 'youtube';

export async function claimGateAccount(opts: {
  eventId: number;
  clanId: number;
  platform: ClaimPlatform;
  platformUserId: string;
  userId: number;
}): Promise<'ok' | 'taken'> {
  const key = and(
    eq(eventGateClaims.eventId, opts.eventId),
    eq(eventGateClaims.platform, opts.platform),
    eq(eventGateClaims.platformUserId, opts.platformUserId),
  );
  for (let attempt = 0; attempt < 3; attempt++) {
    const now = new Date().toISOString();
    const inserted = await db
      .insert(eventGateClaims)
      .values({ eventId: opts.eventId, platform: opts.platform, platformUserId: opts.platformUserId, userId: opts.userId, claimedAt: now })
      .onConflictDoNothing({ target: [eventGateClaims.eventId, eventGateClaims.platform, eventGateClaims.platformUserId] })
      .returning({ userId: eventGateClaims.userId });
    if (inserted.length > 0) return 'ok';

    const row = await db.query.eventGateClaims.findFirst({ where: key });
    if (!row) continue;
    if (row.userId === opts.userId) return 'ok';

    const claimedMs = parseStamp(row.claimedAt);
    const fresh = claimedMs != null && Date.now() - claimedMs < CLAIM_HOLD_MS;
    if (fresh || (await liveInEvent(opts.eventId, opts.clanId, row.userId))) return 'taken';

    const moved = await db
      .update(eventGateClaims)
      .set({ userId: opts.userId, claimedAt: now })
      .where(and(key, eq(eventGateClaims.userId, row.userId)))
      .returning({ userId: eventGateClaims.userId });
    if (moved.length > 0) return 'ok';
  }
  return 'taken';
}
