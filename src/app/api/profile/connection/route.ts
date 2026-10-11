import { NextResponse } from 'next/server';
import { db } from '@/db';
import { accounts, clanRoster, detectedAccounts } from '@/db/schema';
import { findRosterSeats } from '@/lib/roster';
import { and, eq, isNull } from 'drizzle-orm';
import { verifyUser } from '@/lib/auth';

// GET /api/profile/connection
//
// The connect card's beacon. While a member is mid-setup the page has one question — "has the
// plugin reached us yet?" — and this answers it in a few hundred bytes so the card can poll it
// instead of re-rendering the whole locker every few seconds.
//
// `linked` counts accounts rather than listing them: the card only needs to know that something
// changed, and a refresh then re-renders the real list from the server.
export async function GET() {
  const session = await verifyUser();
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [members, pending, owned] = await Promise.all([
    // clan-scope: global -- the subject is a PERSON, and their seats span clans by design; scoped to the caller's own via clanRoster.playerId.
    findRosterSeats(and(eq(clanRoster.playerId, session.playerId), isNull(clanRoster.leftAt))),
    db.query.detectedAccounts.findMany({
      where: and(eq(detectedAccounts.userId, session.userId), eq(detectedAccounts.status, 'pending')),
      columns: { id: true, rsnNormalized: true, accountHash: true },
    }),
    session.playerId == null
      ? Promise.resolve([])
      : db
          .select({ rsnNormalized: accounts.rsnNormalized, accountHash: accounts.accountHash })
          .from(accounts)
          .where(eq(accounts.playerId, session.playerId)),
  ]);

  // Legacy federation anchors (`guest:<discordId>`) aren't accounts — rows a removed feature left behind.
  const real = members.filter((m) => !m.rsn.startsWith('guest:'));
  let lastPingAt: string | null = null;
  let lastPingRsn: string | null = null;
  for (const m of real) {
    if (m.liveStatsAt && (!lastPingAt || m.liveStatsAt > lastPingAt)) {
      lastPingAt = m.liveStatsAt;
      lastPingRsn = m.rsn;
    }
  }

  return NextResponse.json({
    connected: lastPingAt !== null,
    lastPingAt,
    lastPingRsn,
    linked: real.length,
    verified: real.filter((m) => m.verifiedAt).length,
    detected: pending.length,
    // The apex profile counts CHARACTERS, not seats — a clanless person has characters and no seats
    // at all — and hides suggestions for ones they already own. These two match what it renders, so
    // its beacon compares like with like (AddCharacterClient).
    characters: owned.length,
    suggestions: pending.filter(
      (d) =>
        !owned.some((a) => a.rsnNormalized === d.rsnNormalized) &&
        !(d.accountHash && owned.some((a) => a.accountHash === d.accountHash)),
    ).length,
  });
}
