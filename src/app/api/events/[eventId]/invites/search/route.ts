import { NextResponse } from 'next/server';
import { and, eq, isNotNull } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, eventInvites } from '@/db/schema';
import { normalizeRsn, verifyUser } from '@/lib/auth';
import { atLeast } from '@/lib/clanRoles';
import { eventForRequest } from '@/lib/eventScope';

/**
 * Find one person by RSN, so a host can invite them by name.
 *
 * `event_invites` has always taken a clan OR a person, and the POST beside this accepts `playerId` —
 * but nothing could turn "that guy from the other clan" into an id, so only the clan half of
 * inviting was reachable. This is that missing lookup and nothing more.
 *
 * EXACT MATCH, DELIBERATELY. A prefix search over every account on the platform is an enumeration
 * tool: type "a" and read back the roster of the world. An exact normalised RSN confirms only what
 * the asker already typed, and an OSRS name is public anyway — it is on the hiscores and above the
 * player's head. So this answers "does this exact name exist here", never "who is there".
 *
 * VERIFIED ONLY, for the same reason the sign-up form insists on it: an unverified row is a claim
 * about a name, not a person, and inviting one would invite whoever eventually proves it.
 */
export async function GET(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const session = await verifyUser();
  if (!session || !atLeast(session.role, 'admin')) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  const eventId = Number((await params).eventId);
  const event = await eventForRequest(request, eventId);
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const q = normalizeRsn(new URL(request.url).searchParams.get('q') ?? '');
  if (!q) return NextResponse.json({ match: null });

  // clan-scope: global -- inviting somebody from ANOTHER clan is the entire purpose; the account is
  // matched by the exact name the host typed, and the authority check above is the host's own.
  const account = await db
    .select({ playerId: accounts.playerId, rsn: accounts.rsn })
    .from(accounts)
    .where(and(eq(accounts.rsnNormalized, q), isNotNull(accounts.verifiedAt), isNotNull(accounts.playerId)))
    .limit(1)
    .then((r) => r[0]);

  if (!account?.playerId) return NextResponse.json({ match: null });

  // Already invited? The panel would otherwise offer a button that answers 409.
  const already = await db.query.eventInvites.findFirst({
    where: and(eq(eventInvites.eventId, eventId), eq(eventInvites.playerId, account.playerId)),
  });

  return NextResponse.json({
    match: { playerId: account.playerId, rsn: account.rsn, alreadyInvited: !!already },
  });
}
