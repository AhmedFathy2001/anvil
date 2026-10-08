import { NextResponse } from 'next/server';
import { resolveTeamManagement } from '@/lib/teamStaff';
import { rateLimitByKey } from '@/lib/rate-limit';
import { claimTile, cleanNote, listTeamClaims, unclaimTile } from '@/lib/tileClaims';

/**
 * Who on THIS team is planning to go for which tile (lib/tileClaims).
 *
 * Team-private: answered only to the team's own players, captain and team staff. Reading is open to
 * all of them; claiming is for those who actually play (or captain) — staff from a visiting clan can
 * see the plan but not put their name on a tile. You can only drop your own claim, except that the
 * captain or team staff may clear a stale one.
 */
async function member(params: Promise<{ teamId: string }>) {
  const teamId = Number((await params).teamId);
  if (!Number.isInteger(teamId)) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  const m = await resolveTeamManagement(teamId);
  // Same 404 for "no such team" and "not your team": a team's plans are nobody else's business,
  // including whether it exists.
  if (!m) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  return { m };
}

export async function GET(_request: Request, { params }: { params: Promise<{ teamId: string }> }) {
  const found = await member(params);
  if ('error' in found) return found.error;
  const { m } = found;
  return NextResponse.json({
    claims: await listTeamClaims(m.eventId, m.teamId, m.userId),
    canClaim: m.playerId != null || m.isCaptain,
    canClear: m.canManage,
  });
}

// POST { tileId, note? } — claim it (or update your note on it).
export async function POST(request: Request, { params }: { params: Promise<{ teamId: string }> }) {
  const found = await member(params);
  if ('error' in found) return found.error;
  const { m } = found;
  if (m.playerId == null && !m.isCaptain) {
    return NextResponse.json({ error: 'Only players on this team can claim tiles.' }, { status: 403 });
  }
  const rl = await rateLimitByKey('tile-claims', `${m.userId}:${m.teamId}`, { limit: 30, windowMs: 60_000 });
  if (!rl.ok) return NextResponse.json({ error: 'Slow down a moment and try again.' }, { status: 429 });
  const body = (await request.json().catch(() => ({}))) as { tileId?: unknown; note?: unknown };
  const tileId = Number(body.tileId);
  if (!Number.isInteger(tileId)) return NextResponse.json({ error: 'tileId is required' }, { status: 400 });
  const r = await claimTile({
    eventId: m.eventId,
    teamId: m.teamId,
    tileId,
    userId: m.userId,
    participantId: m.playerId,
    note: cleanNote(body.note),
  });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ claims: await listTeamClaims(m.eventId, m.teamId, m.userId) });
}

// DELETE ?tileId=…[&userId=…] — drop your claim; captain/staff may name a teammate's.
export async function DELETE(request: Request, { params }: { params: Promise<{ teamId: string }> }) {
  const found = await member(params);
  if ('error' in found) return found.error;
  const { m } = found;
  const url = new URL(request.url);
  const tileId = Number(url.searchParams.get('tileId'));
  if (!Number.isInteger(tileId)) return NextResponse.json({ error: 'tileId is required' }, { status: 400 });
  const asked = url.searchParams.get('userId');
  const target = asked == null ? m.userId : Number(asked);
  if (!Number.isInteger(target)) return NextResponse.json({ error: 'Invalid userId' }, { status: 400 });
  if (target !== m.userId && !m.canManage) {
    return NextResponse.json({ error: 'You can only drop your own claim.' }, { status: 403 });
  }
  await unclaimTile(m.teamId, tileId, target);
  return NextResponse.json({ claims: await listTeamClaims(m.eventId, m.teamId, m.userId) });
}
