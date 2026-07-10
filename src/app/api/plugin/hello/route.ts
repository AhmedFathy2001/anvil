import { NextResponse } from 'next/server';
import { db } from '@/db';
import { clanMembers, events, weeklyCompetitions } from '@/db/schema';
import { eq, and, lte, gt, isNull, or } from 'drizzle-orm';
import { normalizeRsn } from '@/lib/auth';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';

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
// No auth: anyone running the plugin can ping this. Worst case someone pollutes the guest list,
// which is recoverable from the admin UI — but it's unauthenticated and creates a row per distinct
// RSN, so a per-IP rate limit stops a script from mass-inflating the roster.
export async function POST(request: Request) {
  const rl = await rateLimit(request, 'plugin-hello', { limit: 30, windowMs: 5 * 60 * 1000 });
  if (!rl.ok) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: rateLimitHeaders(rl) });
  }

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

  // A login ping is NOT roster evidence — never resurrect a departed row here.
  // Someone logging into the game hasn't rejoined the clan; only clan-sync (the in-game
  // roster) or an admin may clear leftAt. We only bump liveness for rows still in the roster.
  if (!existing.leftAt) {
    await db
      .update(clanMembers)
      .set({ lastSeenInClan: new Date().toISOString() })
      .where(eq(clanMembers.id, existing.id));
  }

  const knownMember = existing.isGuest === 0 && !existing.leftAt;
  return NextResponse.json({
    knownMember,
    isGuest: !knownMember,
    ...(await activeNow()),
  });
}
