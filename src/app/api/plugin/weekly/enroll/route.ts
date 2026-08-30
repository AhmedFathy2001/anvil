import { NextResponse } from 'next/server';
import { db } from '@/db';
import { resolvePluginClan } from '@/lib/auth';
import { weeklyCompetitions, weeklyParticipants } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { findOrCreateClanMember } from '@/lib/clan';
import { fetchParticipantStat, type CompetitionType } from '@/lib/weekly';
import { normalizeRsn, sanitizeRsn } from '@/lib/auth';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';

// POST — plugin auto-enrolls the signed-in player in the currently active weekly comp.
// No auth: any plugin user may enroll themselves (creates a guest clan member if new).
// Enrollment is idempotent (onConflictDoNothing + an explicit existence check), so
// repeated calls are harmless and don't warrant a rate limit at clan scale.
export async function POST(request: Request) {
  // Unauthenticated + creates a guest member and fires an outbound hiscores fetch per new RSN, so
  // a per-IP rate limit caps leaderboard pollution and outbound amplification.
  const rl = await rateLimit(request, 'plugin-weekly-enroll', { limit: 20, windowMs: 5 * 60 * 1000 });
  if (!rl.ok) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: rateLimitHeaders(rl) });
  }

  // Unauthenticated, so the HOST is the only thing that says which clan to enrol into.
  // As with hello: a clanless address has no competition to enrol into, and saying so beats a 500.
  const clan = await resolvePluginClan(request);
  if (!clan) return NextResponse.json({ enrolled: false });

  let body: { rsn?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const rsn = sanitizeRsn(body.rsn || '');
  if (!rsn) return NextResponse.json({ error: 'rsn required' }, { status: 400 });
  const rsnNormalized = normalizeRsn(rsn);

  // THIS clan's active competition. The comment four lines up already said the host is the only
  // thing naming the clan — but the query did not use it, so `findFirst` returned whichever active
  // competition the planner reached first across the whole platform. The seat below is created in
  // `clan.id` regardless, so a member of a clan with no weekly running was enrolled into a DIFFERENT
  // clan's SOTW/BOTW, holding a participant row keyed to a seat that clan has never heard of. A
  // cross-clan write, from an unauthenticated endpoint, on autopilot at every login.
  const active = await db.query.weeklyCompetitions.findFirst({
    where: and(eq(weeklyCompetitions.clanId, clan.id), eq(weeklyCompetitions.status, 'active')),
  });
  if (!active) return NextResponse.json({ enrolled: false, reason: 'no-active-comp' });

  const clanMemberId = await findOrCreateClanMember(clan.id, rsn);

  const existing = await db.query.weeklyParticipants.findFirst({
    where: and(
      eq(weeklyParticipants.competitionId, active.id),
      eq(weeklyParticipants.rsnNormalized, rsnNormalized),
    ),
  });
  if (existing) {
    return NextResponse.json({ enrolled: true, alreadyEnrolled: true, compId: active.id });
  }

  // Lock baseline from hiscores; null is acceptable, cron will retry.
  // Transient failures: leave baseline null and the cron will pick it up. Unranked
  // failures: still enroll, but the cron will skip them once we flag the clan_member
  // unranked elsewhere — leaving baseline null keeps them out of the leaderboard
  // until they reappear on hiscores.
  const result = await fetchParticipantStat(rsn, active.type as CompetitionType, active.metric);
  const baseline = result.kind === 'value' ? result.value : null;

  // onConflictDoNothing covers the check-then-insert race where two concurrent
  // enroll calls for the same RSN both pass the existing-check above.
  const inserted = await db
    .insert(weeklyParticipants)
    .values({
      competitionId: active.id,
      clanMemberId,
      rsn,
      rsnNormalized,
      baselineValue: baseline,
      lastUpdated: baseline !== null ? new Date().toISOString() : null,
    })
    .onConflictDoNothing()
    .returning();

  if (inserted.length === 0) {
    return NextResponse.json({ enrolled: true, alreadyEnrolled: true, compId: active.id });
  }

  return NextResponse.json({
    enrolled: true,
    compId: active.id,
    compTitle: active.title,
    baselineValue: baseline,
  });
}
