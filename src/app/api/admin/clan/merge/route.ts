import { NextResponse } from 'next/server';
import { verifyAdminOrModerator } from '@/lib/auth';
import { requireClanFromRequest } from '@/lib/clanContext';
import { mergeSeats } from '@/lib/mergeSeats';

// POST /api/admin/clan/merge { sourceId, targetId }
// Merge two roster seats that are actually the same player (typically a left+joined pair from a
// rename, which clan-sync can only see by name). Moves all references to target and deletes source;
// the survivor keeps whichever name the in-game roster still lists — see lib/mergeSeats.
export async function POST(request: Request) {
  const session = await verifyAdminOrModerator();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { sourceId?: number; targetId?: number; note?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const sourceId = Number(body.sourceId);
  const targetId = Number(body.targetId);
  if (!Number.isFinite(sourceId) || !Number.isFinite(targetId) || sourceId === targetId) {
    return NextResponse.json({ error: 'Distinct sourceId and targetId required' }, { status: 400 });
  }

  // BOTH SEATS MUST BE THIS CLAN'S. Seat ids are global and these two arrive in the request body,
  // so unscoped this let an admin of any clan merge two of another clan's members. mergeSeats
  // answers 404 for a seat outside the clan, so the error cannot probe which ids exist elsewhere.
  const clan = await requireClanFromRequest(request);
  const result = await mergeSeats({
    clanId: clan.id,
    sourceId,
    targetId,
    actorUserId: session.userId > 0 ? session.userId : null,
    note: body.note,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ success: true, targetId: result.targetId, mergedRsn: result.mergedRsn, rsn: result.rsn });
}
