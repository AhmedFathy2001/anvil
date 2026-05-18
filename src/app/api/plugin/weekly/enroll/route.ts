import { NextResponse } from 'next/server';
import { db } from '@/db';
import { weeklyCompetitions, weeklyParticipants } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { findOrCreateClanMember } from '@/lib/clan';
import { fetchParticipantStat } from '@/lib/weekly';
import { normalizeRsn, sanitizeRsn } from '@/lib/auth';

// POST — plugin auto-enrolls the signed-in player in the currently active weekly comp.
// No auth: any plugin user may enroll themselves (creates a guest clan member if new).
// Enrollment is idempotent (onConflictDoNothing + an explicit existence check), so
// repeated calls are harmless and don't warrant a rate limit at clan scale.
export async function POST(request: Request) {
  let body: { rsn?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const rsn = sanitizeRsn(body.rsn || '');
  if (!rsn) return NextResponse.json({ error: 'rsn required' }, { status: 400 });
  const rsnNormalized = normalizeRsn(rsn);

  const active = await db.query.weeklyCompetitions.findFirst({
    where: eq(weeklyCompetitions.status, 'active'),
  });
  if (!active) return NextResponse.json({ enrolled: false, reason: 'no-active-comp' });

  const clanMemberId = await findOrCreateClanMember(rsn);

  const existing = await db.query.weeklyParticipants.findFirst({
    where: and(
      eq(weeklyParticipants.competitionId, active.id),
      eq(weeklyParticipants.rsnNormalized, rsnNormalized),
    ),
  });
  if (existing) {
    return NextResponse.json({ enrolled: true, alreadyEnrolled: true, compId: active.id });
  }

  // Lock baseline from hiscores; null is acceptable, cron will retry
  const baseline = await fetchParticipantStat(rsn, active.type as 'skill' | 'boss', active.metric);

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
