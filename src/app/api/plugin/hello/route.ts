import { NextResponse } from 'next/server';
import { db } from '@/db';
import { requirePluginClan } from '@/lib/auth';
import { clanMemberships, clanRoster, events, weeklyCompetitions } from '@/db/schema';
import { findOrCreateAccount, findOrCreateSeat, findRosterSeat } from '@/lib/roster';
import { eq, and, lte, gt, isNull, or } from 'drizzle-orm';
import { normalizeRsn } from '@/lib/auth';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';
import { weeklyMetricLabel } from '@/lib/constants';
import { admit } from '@/lib/guestAdmission';

// What's running right now — surfaced to the plugin so it can greet the player in-game with the
// live SOTW/BOTW and bingos. Public info (same as the site board), so safe on this no-auth route —
// but public means THIS clan's board, so the clan is a parameter rather than an assumption.
async function activeNow(clan: { id: number }) {
  const nowIso = new Date().toISOString();
  const [activeWeekly, activeBingos] = await Promise.all([
    db
      .select({ type: weeklyCompetitions.type, title: weeklyCompetitions.title, metric: weeklyCompetitions.metric })
      .from(weeklyCompetitions)
      .where(and(eq(weeklyCompetitions.clanId, clan.id), eq(weeklyCompetitions.status, 'active'))),
    db
      .select({ name: events.name })
      .from(events)
      .where(
        and(
          eq(events.clanId, clan.id),
          isNull(events.forceEndedAt),
          lte(events.startDate, nowIso),
          or(isNull(events.endDate), gt(events.endDate, nowIso)),
        ),
      ),
  ]);
  // The greeting names the metric, so it ships the label with the key — "Phosani's Nightmare",
  // not the hiscores spelling of it.
  return {
    activeWeekly: activeWeekly.map((w) => ({ ...w, metricLabel: weeklyMetricLabel(w.type, w.metric) })),
    activeBingos,
  };
}

// POST — plugin says "this RSN just logged in". If unknown, auto-register as guest.
// No auth: anyone running the plugin can ping this. Worst case someone pollutes the guest list,
// which is recoverable from the admin UI — but it's unauthenticated and creates a row per distinct
// RSN, so a per-IP rate limit stops a script from mass-inflating the roster.
export async function POST(request: Request) {
  // Unauthenticated, so the Host is the only thing that names the clan being written to.
  const clan = await requirePluginClan(request);
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
  // Scoped to the clan named by the Host: the same RSN legitimately sits on other clans' rosters.
  const existing = await findRosterSeat(and(eq(clanRoster.clanId, clan.id), eq(clanRoster.rsnNormalized, rsnNormalized)));

  if (!existing) {
    // A login ping says the account exists and is playing. It says NOTHING about membership — and it
    // used to create a guest seat anyway, so anyone who logged in once appeared on a roster nobody
    // had agreed to put them on. Unauthenticated, at that.
    //
    // Now it asks. Under the default policy that means a request for staff, and no seat.
    const account = await findOrCreateAccount({ rsn, rsnNormalized });
    const result = await admit({ clanId: clan.id, accountId: account.id, source: 'plugin' });

    if (result.outcome === 'seated') {
      await db
        .update(clanMemberships)
        .set({ lastSeenInClan: new Date().toISOString() })
        .where(eq(clanMemberships.id, result.seatId));
    }

    return NextResponse.json({
      knownMember: false,
      isGuest: result.outcome === 'seated',
      // What actually happened, so the plugin can say "waiting for staff" rather than implying they
      // are on the roster when they are not.
      admission: result.outcome,
      ...(await activeNow(clan)),
    });
  }

  // A login ping is NOT roster evidence — never resurrect a departed row here.
  // Someone logging into the game hasn't rejoined the clan; only clan-sync (the in-game
  // roster) or an admin may clear leftAt. We only bump liveness for rows still in the roster.
  if (!existing.leftAt) {
    await db
      .update(clanMemberships)
      .set({ lastSeenInClan: new Date().toISOString() })
      .where(eq(clanMemberships.id, existing.id));
  }

  const knownMember = existing.kind === 'member' && !existing.leftAt;
  return NextResponse.json({
    knownMember,
    isGuest: !knownMember,
    ...(await activeNow(clan)),
  });
}
