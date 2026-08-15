import { NextResponse } from 'next/server';
import { db } from '@/db';
import { clanMembers, detectedAccounts } from '@/db/schema';
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

  const [members, pending] = await Promise.all([
    db.query.clanMembers.findMany({
      where: and(eq(clanMembers.userId, session.userId), isNull(clanMembers.leftAt)),
      columns: { rsn: true, liveStatsAt: true, verifiedAt: true },
    }),
    db.query.detectedAccounts.findMany({
      where: and(eq(detectedAccounts.userId, session.userId), eq(detectedAccounts.status, 'pending')),
      columns: { id: true },
    }),
  ]);

  // Federation anchors (`guest:<discordId>`) aren't accounts — see api/federation/v1/exchange.
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
  });
}
