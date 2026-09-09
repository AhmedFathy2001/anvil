import { NextResponse } from 'next/server';
import { competitionForRequest } from '@/lib/eventScope';
import { normalizeRsn, sanitizeRsn, verifyAdminOrModerator } from '@/lib/auth';
import { db } from '@/db';
import { requireClan } from '@/lib/clanContext';
import { clanRoster, weeklyCompetitions, weeklyParticipants } from '@/db/schema';
import { and, eq, getTableColumns, inArray, isNull } from 'drizzle-orm';
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
  // clan-scope: global -- joined onto a driving query that is already scoped; this clause adds columns, not rows.
  const participants = await db
    .select({
      ...getTableColumns(weeklyParticipants),
      leftAt: clanRoster.leftAt,
      clanStatus: clanRoster.status,
      // Whether this seat is a member or a guest OF THIS CLAN, and which human is behind it. Both
      // were already on the view and neither was selected, so the participants table could not say
      // "this is a guest" or "these two rows are the same person with two characters" — the two
      // things an admin needs in order to do anything about either.
      kind: clanRoster.kind,
      playerId: clanRoster.playerId,
    })
    .from(weeklyParticipants)
    .leftJoin(clanRoster, eq(weeklyParticipants.clanMemberId, clanRoster.id))
    .where(eq(weeklyParticipants.competitionId, compId));

  // Enrollment diagnostics — answers "why is the count one short?" without DB spelunking:
  //   notEnrolled — active roster members (per the guest setting) with no participant row.
  //   duplicates  — roster rows that collapse to the same normalized RSN; the unique index
  //                 silently absorbs the second one at enroll time.
  // Guest inclusion is per-competition (weekly_competitions.include_guests), set when the comp was
  // created. Missing row → treat as included, matching the column default.
  const compRow = await competitionForRequest(request, compId);
  if (!compRow) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const trackGuests = compRow.includeGuests !== 0;
  const baseClause = and(
    eq(clanRoster.clanId, compRow.clanId),
    isNull(clanRoster.leftAt),
    eq(clanRoster.status, 'active'),
  );
  // Pull the FULL active roster (guests included) so exclusions are named, not invisible —
  // "124 of 125" is usually one member sitting outside the enrollment filter.
  const fullRoster = await db
    .select({ rsn: clanRoster.rsn, kind: clanRoster.kind, status: clanRoster.status })
    .from(clanRoster)
    // baseClause carries eq(clanRoster.clanId, compRow.clanId) — see above.
    .where(baseClause);
  const roster = trackGuests ? fullRoster : fullRoster.filter((m) => m.kind === 'member');
  const enrolledNorm = new Set(participants.map((r) => r.rsnNormalized));
  const notEnrolled = roster.filter((m) => !enrolledNorm.has(normalizeRsn(m.rsn))).map((m) => m.rsn);
  // Active members excluded from auto-enrollment by this comp's guest setting (named so the admin
  // can add them manually or clear their guest flag).
  const guestsExcluded = trackGuests
    ? []
    : fullRoster.filter((m) => m.kind === 'guest' && !enrolledNorm.has(normalizeRsn(m.rsn))).map((m) => m.rsn);
  // Every guest on the roster who is not in, whatever the comp's blanket setting says. `guestsExcluded`
  // above answers "who did the switch keep out"; this answers "who could I add", which is the
  // question when the switch is ON and somebody joined after the fanout ran.
  const guestsAvailable = fullRoster
    .filter((m) => m.kind === 'guest' && !enrolledNorm.has(normalizeRsn(m.rsn)))
    .map((m) => m.rsn);
  // Non-active roster rows are excluded too — name them for the same reason.
  const inactive = await db
    .select({ rsn: clanRoster.rsn, status: clanRoster.status })
    .from(clanRoster)
    .where(and(eq(clanRoster.clanId, compRow.clanId), isNull(clanRoster.leftAt)));
  const inactiveExcluded = inactive
    .filter((m) => m.status !== 'active' && !enrolledNorm.has(normalizeRsn(m.rsn)))
    .map((m) => `${m.rsn} (${m.status})`);
  const byNorm = new Map<string, string[]>();
  for (const m of roster) {
    const n = normalizeRsn(m.rsn);
    byNorm.set(n, [...(byNorm.get(n) ?? []), m.rsn]);
  }
  const duplicates = [...byNorm.values()].filter((names) => names.length > 1);

  return NextResponse.json({
    participants,
    notEnrolled,
    duplicates,
    guestsExcluded,
    guestsAvailable,
    inactiveExcluded,
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAdminOrModerator();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const clan = await requireClan();

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
      const clanMemberId = await findOrCreateClanMember(clan.id, trimmed);
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
// only future progress — the standard treatment of a fresh post-logout snapshot.
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

/**
 * Take somebody out of a competition.
 *
 * THE HALF THAT WAS MISSING. Enrollment fans out over every seat on the roster, gated by one
 * blanket includeGuests switch, and POST above can add anybody by name — but nothing could remove
 * anybody, ever. So "include the guests, minus the three who are not really playing" was not a
 * thing an admin could express: the only way to get there was to run with guests OFF and re-type
 * the names of everyone you did want.
 *
 * The rows carry the scores, so this is a real deletion of a competitor's entry rather than a flag.
 * That is deliberate and it is why the UI confirms with the numbers in front of you: a participant
 * with a baseline and a current value has a standing, and removing them forfeits it. Re-adding by
 * name afterwards starts a fresh baseline, which is not the same thing as never having left.
 *
 * `keepIfLeft` is NOT this. That covers somebody who left the CLAN mid-competition and whether their
 * score still counts; this covers somebody who should not have been entered at all.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAdminOrModerator();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const compId = parseInt(id, 10);

  // WHOSE COMPETITION IS THIS? The id came from the URL, and being staff somewhere satisfies the
  // check above — the same gap the scope guard on PUT exists to close.
  if (!(await competitionForRequest(request, compId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  // One id or many: the UI removes a row at a time, and offers "drop every guest" / "one entry per
  // person" in a batch. Same endpoint, so there is one place that decides what removal means.
  const raw = Array.isArray(body.participantIds)
    ? body.participantIds
    : body.participantId != null
      ? [body.participantId]
      : [];
  const ids = raw.filter((n: unknown): n is number => typeof n === 'number' && Number.isInteger(n));

  if (ids.length === 0) {
    return NextResponse.json({ error: 'participantId or participantIds is required' }, { status: 400 });
  }

  // Scoped to THIS competition in the same statement, so an id belonging to another clan's week
  // cannot be deleted by guessing it.
  const removed = await db
    .delete(weeklyParticipants)
    .where(and(eq(weeklyParticipants.competitionId, compId), inArray(weeklyParticipants.id, ids)))
    .returning({ id: weeklyParticipants.id });

  return NextResponse.json({ removed: removed.length });
}
