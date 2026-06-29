import { NextResponse } from 'next/server';
import { db } from '@/db';
import { clanMembers, detectedAccounts } from '@/db/schema';
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
    db.query.clanMembers.findMany({
      where: and(eq(clanMembers.userId, session.userId), isNull(clanMembers.leftAt)),
      columns: { rsnNormalized: true, accountHash: true },
    }),
  ]);

  const ownedRsns = new Set(owned.map((m) => m.rsnNormalized));
  const ownedHashes = new Set(owned.map((m) => m.accountHash).filter(Boolean) as string[]);

  const accounts = pending
    .filter((d) => !ownedRsns.has(d.rsnNormalized) && !(d.accountHash && ownedHashes.has(d.accountHash)))
    .map((d) => ({ id: d.id, rsn: d.rsn, lastSeenAt: d.lastSeenAt }));

  return NextResponse.json({ accounts });
}
