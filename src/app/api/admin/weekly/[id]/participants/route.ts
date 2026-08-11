import { NextResponse } from 'next/server';
import { normalizeRsn, sanitizeRsn, verifyAdminOrModerator } from '@/lib/auth';
import { db } from '@/db';
import { clanMembers, weeklyCompetitions, weeklyParticipants } from '@/db/schema';
import { and, eq, getTableColumns, isNull } from 'drizzle-orm';
import { findOrCreateClanMember } from '@/lib/clan';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAdminOrModerator();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const compId = parseInt(id, 10);

  // All participants (including leavers) plus their clan status, so the admin UI can flag who left
  // and offer the keep-override toggle.
  const participants = await db
    .select({
      ...getTableColumns(weeklyParticipants),
      leftAt: clanMembers.leftAt,
      clanStatus: clanMembers.status,
    })
    .from(weeklyParticipants)
    .leftJoin(clanMembers, eq(weeklyParticipants.clanMemberId, clanMembers.id))
    .where(eq(weeklyParticipants.competitionId, compId));

  // Enrollment diagnostics — answers "why is the count one short?" without DB spelunking:
  //   notEnrolled — active roster members (per the guest setting) with no participant row.
  //   duplicates  — roster rows that collapse to the same normalized RSN; the unique index
  //                 silently absorbs the second one at enroll time.
  // Guest inclusion is per-competition (weekly_competitions.include_guests), set when the comp was
  // created. Missing row → treat as included, matching the column default.
  const compRow = await db.query.weeklyCompetitions.findFirst({
    where: eq(weeklyCompetitions.id, compId),
    columns: { includeGuests: true },
  });
  const trackGuests = compRow?.includeGuests !== 0;
  const baseClause = and(isNull(clanMembers.leftAt), eq(clanMembers.status, 'active'));
  // Pull the FULL active roster (guests included) so exclusions are named, not invisible —
  // "124 of 125" is usually one member sitting outside the enrollment filter.
  const fullRoster = await db
    .select({ rsn: clanMembers.rsn, isGuest: clanMembers.isGuest, status: clanMembers.status })
    .from(clanMembers)
    .where(baseClause);
  const roster = trackGuests ? fullRoster : fullRoster.filter((m) => m.isGuest === 0);
  const enrolledNorm = new Set(participants.map((r) => r.rsnNormalized));
  const notEnrolled = roster.filter((m) => !enrolledNorm.has(normalizeRsn(m.rsn))).map((m) => m.rsn);
  // Active members excluded from auto-enrollment by this comp's guest setting (named so the admin
  // can add them manually or clear their guest flag).
  const guestsExcluded = trackGuests
    ? []
    : fullRoster.filter((m) => m.isGuest === 1 && !enrolledNorm.has(normalizeRsn(m.rsn))).map((m) => m.rsn);
  // Non-active roster rows are excluded too — name them for the same reason.
  const inactive = await db
    .select({ rsn: clanMembers.rsn, status: clanMembers.status })
    .from(clanMembers)
    .where(isNull(clanMembers.leftAt));
  const inactiveExcluded = inactive
    .filter((m) => m.status !== 'active' && !enrolledNorm.has(normalizeRsn(m.rsn)))
    .map((m) => `${m.rsn} (${m.status})`);
  const byNorm = new Map<string, string[]>();
  for (const m of roster) {
    const n = normalizeRsn(m.rsn);
    byNorm.set(n, [...(byNorm.get(n) ?? []), m.rsn]);
  }
  const duplicates = [...byNorm.values()].filter((names) => names.length > 1);

  return NextResponse.json({ participants, notEnrolled, duplicates, guestsExcluded, inactiveExcluded });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAdminOrModerator();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const compId = parseInt(id, 10);
  const { rsns } = await request.json();

  if (!Array.isArray(rsns) || rsns.length === 0) {
    return NextResponse.json({ error: 'rsns array is required' }, { status: 400 });
  }

  let added = 0;
  for (const rsn of rsns) {
    if (typeof rsn !== 'string') continue;
    const trimmed = sanitizeRsn(rsn);
    if (!trimmed) continue;
    try {
      const clanMemberId = await findOrCreateClanMember(trimmed);
      await db.insert(weeklyParticipants).values({
        competitionId: compId,
        clanMemberId,
        rsn: trimmed,
        rsnNormalized: normalizeRsn(trimmed),
      }).onConflictDoNothing();
      added++;
    } catch {
      // Skip on error
    }
  }

  return NextResponse.json({ added });
}

// Manually correct a participant's baseline. Used to fix the stale-baseline overcount
// (player grinding across the comp start while logged in — see src/lib/gainsValidation.ts).
// Setting baseline to the current value zeroes out the bogus pre-event gain and counts
// only future progress, which mirrors how WOM treats a fresh post-logout snapshot.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAdminOrModerator();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const compId = parseInt(id, 10);
  const { participantId, baselineValue, keepIfLeft } = await request.json();

  if (typeof participantId !== 'number' || !Number.isInteger(participantId)) {
    return NextResponse.json({ error: 'participantId (number) is required' }, { status: 400 });
  }

  // Toggle the keep-if-left override (re-include a participant who left the CC, or drop them again).
  if (typeof keepIfLeft === 'boolean') {
    const updated = await db
      .update(weeklyParticipants)
      .set({ keepIfLeft: keepIfLeft ? 1 : 0 })
      .where(and(eq(weeklyParticipants.id, participantId), eq(weeklyParticipants.competitionId, compId)))
      .returning({ id: weeklyParticipants.id });
    if (updated.length === 0) {
      return NextResponse.json({ error: 'Participant not found in this competition' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  }

  if (typeof baselineValue !== 'number' || !Number.isFinite(baselineValue) || baselineValue < 0) {
    return NextResponse.json({ error: 'baselineValue must be a non-negative number' }, { status: 400 });
  }

  const updated = await db
    .update(weeklyParticipants)
    .set({ baselineValue: Math.round(baselineValue), flagged: 0, flagReason: null })
    .where(and(eq(weeklyParticipants.id, participantId), eq(weeklyParticipants.competitionId, compId)))
    .returning({ id: weeklyParticipants.id });

  if (updated.length === 0) {
    return NextResponse.json({ error: 'Participant not found in this competition' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
