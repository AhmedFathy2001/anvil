import { NextResponse } from 'next/server';
import { db } from '@/db';
import { clanMembers, events, weeklyCompetitions } from '@/db/schema';
import { eq, and, lte, gt, isNull, or } from 'drizzle-orm';
import { normalizeRsn } from '@/lib/auth';

// What's running right now — surfaced to the plugin so it can greet the player in-game with the
// live SOTW/BOTW and bingos. Public info (same as the site board), so safe on this no-auth route.
async function activeNow() {
  const nowIso = new Date().toISOString();
  const [activeWeekly, activeBingos] = await Promise.all([
    db
      .select({ type: weeklyCompetitions.type, title: weeklyCompetitions.title, metric: weeklyCompetitions.metric })
      .from(weeklyCompetitions)
      .where(eq(weeklyCompetitions.status, 'active')),
    db
      .select({ name: events.name })
      .from(events)
      .where(
        and(
          isNull(events.forceEndedAt),
          lte(events.startDate, nowIso),
          or(isNull(events.endDate), gt(events.endDate, nowIso)),
        ),
      ),
  ]);
  return { activeWeekly, activeBingos };
}

// POST — plugin says "this RSN just logged in". If unknown, auto-register as guest.
// No auth: anyone running the plugin can ping this. Worst case someone pollutes the
// guest list, which is recoverable from the admin UI. No rate limit — upsert is
// cheap, the cost is bounded by distinct RSNs, and admins can bulk-clean guests.
export async function POST(request: Request) {
  let body: { rsn?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const rsn = (body.rsn || '').trim();
  if (!rsn) return NextResponse.json({ error: 'rsn required' }, { status: 400 });

  const rsnNormalized = normalizeRsn(rsn);
  const existing = await db.query.clanMembers.findFirst({
    where: eq(clanMembers.rsnNormalized, rsnNormalized),
  });

  if (!existing) {
    await db.insert(clanMembers).values({
      rsn,
      rsnNormalized,
      source: 'plugin-self',
      isGuest: 1,
      lastSeenInClan: new Date().toISOString(),
    });
    return NextResponse.json({ knownMember: false, isGuest: true, ...(await activeNow()) });
  }

  if (existing.leftAt) {
    await db
      .update(clanMembers)
      .set({ leftAt: null, lastSeenInClan: new Date().toISOString() })
      .where(eq(clanMembers.id, existing.id));
  } else {
    await db
      .update(clanMembers)
      .set({ lastSeenInClan: new Date().toISOString() })
      .where(eq(clanMembers.id, existing.id));
  }

  return NextResponse.json({
    knownMember: existing.isGuest === 0,
    isGuest: existing.isGuest === 1,
    ...(await activeNow()),
  });
}
