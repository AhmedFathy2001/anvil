import { NextResponse } from 'next/server';
import { db } from '@/db';
import { clanRoster, detectedAccounts } from '@/db/schema';
import { findRosterSeats } from '@/lib/roster';
import { and, eq, isNull } from 'drizzle-orm';
import { verifyUser } from '@/lib/auth';

// GET /api/profile/detected-accounts
//
// The opt-in inbox: accounts the plugin saw this user play that aren't yet attributed to
// anyone. Returns only 'pending' rows, and filters out any that have since become owned by
// this user through another path (web verify, a prior Add) so the inbox never shows an
// account that's already on their RuneScape Accounts list.
export async function GET() {
  const session = await verifyUser();
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [pending, owned] = await Promise.all([
    db.query.detectedAccounts.findMany({
      where: and(eq(detectedAccounts.userId, session.userId), eq(detectedAccounts.status, 'pending')),
      orderBy: (d, { desc }) => [desc(d.lastSeenAt)],
    }),
    findRosterSeats(and(eq(clanRoster.playerId, session.userId), isNull(clanRoster.leftAt))),
  ]);

  const ownedRsns = new Set(owned.map((m) => m.rsnNormalized));
  const ownedHashes = new Set(owned.map((m) => m.accountHash).filter(Boolean) as string[]);

  const accounts = pending
    .filter((d) => !ownedRsns.has(d.rsnNormalized) && !(d.accountHash && ownedHashes.has(d.accountHash)))
    .map((d) => ({ id: d.id, rsn: d.rsn, lastSeenAt: d.lastSeenAt }));

  return NextResponse.json({ accounts });
}
