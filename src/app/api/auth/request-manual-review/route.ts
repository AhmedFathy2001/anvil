import { NextResponse } from 'next/server';
import { verifyUser } from '@/lib/auth';
import { claimRsnForUser, isPlausibleRsn } from '@/lib/rsnClaim';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';

// POST /api/auth/request-manual-review { rsn, note? }
// Last-resort path for users who can't use the plugin (no RuneLite) and can't use stat-delta
// (Hiscores opt-out, brand new account, etc). Creates or updates a clan_members row attached
// to the requesting user, marked provisional with method='manual'. The row lands in the
// moderator approval queue alongside stat-delta entries; the mod's note column shows the
// reason the user gave.
//
// The claim itself lives in lib/rsnClaim — the Discord role panel performs exactly the same
// operation from a modal, and the ownership rules must not differ by which door someone came in.
export async function POST(request: Request) {
  const session = await verifyUser();
  if (!session || session.userId <= 0) {
    return NextResponse.json({ error: 'Sign in with Discord first' }, { status: 401 });
  }

  // Manual claims sit in a mod queue forever once submitted, so a tighter limit
  // discourages spam without blocking legitimate retries.
  const rl = await rateLimit(request, 'manual-review-request', { limit: 5, windowMs: 60 * 60 * 1000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many requests — try again later.' },
      { status: 429, headers: rateLimitHeaders(rl) },
    );
  }

  let body: { rsn?: string; note?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const rsn = (body.rsn || '').trim();
  if (!isPlausibleRsn(rsn)) {
    return NextResponse.json({ error: 'Provide a valid RSN' }, { status: 400 });
  }

  const result = await claimRsnForUser({ userId: session.userId, rsn, note: body.note });
  if (!result.ok) {
    if (result.reason === 'owned-by-someone-else') {
      return NextResponse.json(
        { error: 'This account is already linked to another user. Contact a moderator if you believe this is wrong.' },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: 'Provide a valid RSN' }, { status: 400 });
  }

  return NextResponse.json({ success: true, clanMemberId: result.clanMemberId, status: 'pending_review' });
}
