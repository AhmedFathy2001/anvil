import { NextResponse } from 'next/server';
import { verifyUser } from '@/lib/auth';
import { joinViaInvite } from '@/lib/teamInvitesStore';
import { isWellFormedToken } from '@/lib/teamInvites';
import { rateLimitByKey, rateLimitHeaders } from '@/lib/rate-limit';

/**
 * Take a seat on the team the link names.
 *
 * The link is not a login: this still requires a Discord session and still refuses an account that
 * isn't the caller's, isn't verified, or has left the clan. All the invite decides is which team
 * the resulting sign-up belongs to, and that it needs no approval.
 *
 * Rate-limited per user rather than per token — a shared link is MEANT to be opened by many people
 * at once, so limiting the token would punish exactly the case it exists for.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string; token: string }> },
) {
  const session = await verifyUser();
  if (!session) return NextResponse.json({ error: 'Sign in to join' }, { status: 401 });

  const { eventId, token } = await params;
  const id = parseInt(eventId, 10);
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'Invalid event id' }, { status: 400 });
  if (!isWellFormedToken(token)) return NextResponse.json({ error: 'That invite link is not valid.' }, { status: 400 });

  const limit = await rateLimitByKey('team-invite-join', String(session.userId), { limit: 10, windowMs: 60_000 });
  if (!limit.ok) {
    return NextResponse.json({ error: 'Too many attempts — wait a minute' }, { status: 429, headers: rateLimitHeaders(limit) });
  }

  let body: { clanMemberId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const clanMemberId = typeof body?.clanMemberId === 'number' ? body.clanMemberId : NaN;
  if (!Number.isFinite(clanMemberId)) return NextResponse.json({ error: 'Pick which account you are playing' }, { status: 400 });

  const result = await joinViaInvite({ eventId: id, token, userId: session.userId, clanMemberId });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  return NextResponse.json({ ok: true, alreadyOn: result.alreadyOn, teamName: result.teamName });
}
