import { NextResponse } from 'next/server';
import { db } from '@/db';
import { clanAuditLog, clanRoster } from '@/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { verifyAdminOrModerator } from '@/lib/auth';
import { requireClanFromRequest } from '@/lib/clanContext';
import { detectSuspectedRenames } from '@/lib/renameDetection';

// GET /api/admin/clan/suspected-renames
//
// "X left, Y joined" pairs in THIS clan that look like one player renamed — the in-game roster only
// carries names, so a rename arrives as a leave plus a join. The evidence and the pairing live in
// lib/renameDetection (same rank, close in time, matching XP). Confident pairs are healed by the
// cron within a tick; what is left here is the ambiguous remainder for a human.
//
// SCOPED TO THE CLAN. This used to read every clan's left/joined audit rows, so one clan's review
// screen could list (and its Confirm/Not-a-rename act on) another clan's members.
export async function GET(request: Request) {
  const session = await verifyAdminOrModerator();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const clan = await requireClanFromRequest(request);
  const suggestions = await detectSuspectedRenames(clan.id, { lookbackDays: 30, liveFetchCap: 8 });
  return NextResponse.json({ suggestions });
}

// POST /api/admin/clan/suspected-renames  { leftMemberId, joinedMemberId }
// Records a "Not a rename" dismissal so the pair never resurfaces in the suggestion
// list. Stored as a 'rename_dismissed' audit row (against the joined member) so it's
// visible in the audit feed and survives reloads.
export async function POST(request: Request) {
  const session = await verifyAdminOrModerator();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { leftMemberId?: number; joinedMemberId?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const leftMemberId = Number(body.leftMemberId);
  const joinedMemberId = Number(body.joinedMemberId);
  if (!Number.isFinite(leftMemberId) || !Number.isFinite(joinedMemberId) || leftMemberId === joinedMemberId) {
    return NextResponse.json({ error: 'Distinct leftMemberId and joinedMemberId required' }, { status: 400 });
  }

  // Both seats must be THIS clan's — the ids arrive in the body.
  const clan = await requireClanFromRequest(request);
  const seats = await db
    .select({ id: clanRoster.id })
    .from(clanRoster)
    .where(and(eq(clanRoster.clanId, clan.id), inArray(clanRoster.id, [leftMemberId, joinedMemberId])));
  if (seats.length !== 2) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await db.insert(clanAuditLog).values({
    clanId: clan.id,
    clanMemberId: joinedMemberId,
    eventType: 'rename_dismissed',
    oldValue: JSON.stringify({ memberId: leftMemberId }),
    newValue: JSON.stringify({ memberId: joinedMemberId }),
    actorUserId: session.userId > 0 ? session.userId : null,
    notes: 'Mod marked suspected left+joined pair as not a rename',
  });

  return NextResponse.json({ success: true });
}
