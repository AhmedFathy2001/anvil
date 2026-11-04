import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { accounts } from '@/db/schema';
import { normalizeRsn, verifyUser } from '@/lib/auth';
import { fileCharacterReport } from '@/lib/characterReports';
import { resolveClanFromRequest } from '@/lib/clanContext';
import { rateLimitByKey } from '@/lib/rate-limit';
import { startOwnershipClaim } from '@/lib/ownershipClaims';

// POST /api/profile/claim-dispute { rsn, note? } — "This is my character" on the website.
//
// The site's twin of the plugin's "This is my account" (/api/plugin/account, action 'dispute'), and
// the SAME flow: an ownership claim (lib/ownershipClaims) that starts with the XP check — the claimant
// proves control, and only then is the owner (or Anvil staff) told. It used to file a bare staff
// report from the website while the plugin ran the claim, so the two buttons did different things.
// Looked up by NAME only, as the plugin's is. Where the XP check can't run (an unranked character,
// the hiscores down) it falls back, as the plugin does, to a wrong-owner report for staff —
// unproved, and it says so. Idempotent: pressing it again shows the claim already in flight.
export async function POST(request: Request) {
  const session = await verifyUser();
  if (!session?.userId) return NextResponse.json({ error: 'Sign in with Discord first' }, { status: 401 });

  const rl = await rateLimitByKey('claim-dispute', String(session.userId), { limit: 10, windowMs: 60 * 60 * 1000 });
  if (!rl.ok) return NextResponse.json({ error: 'Too many reports — try again in a while.' }, { status: 429 });

  const body = (await request.json().catch(() => null)) as { rsn?: unknown; note?: unknown } | null;
  const rsn = typeof body?.rsn === 'string' ? body.rsn.trim() : '';
  if (!rsn || rsn.length > 12) return NextResponse.json({ error: 'Which character? Give its name.' }, { status: 400 });
  const note = typeof body?.note === 'string' ? body.note.trim().slice(0, 500) : '';

  // clan-scope: global -- a character is one row however many clans roster it; the question is who holds it.
  const [account] = await db
    .select({ id: accounts.id, rsn: accounts.rsn, playerId: accounts.playerId, claimedAt: accounts.claimedAt })
    .from(accounts)
    .where(eq(accounts.rsnNormalized, normalizeRsn(rsn)))
    .limit(1);
  if (!account || account.claimedAt == null) {
    return NextResponse.json({ error: 'Nobody has linked that character — you can link it yourself.' }, { status: 409 });
  }
  if (account.playerId === session.playerId) {
    return NextResponse.json({ error: 'That character is already linked to you.' }, { status: 409 });
  }

  // The claim, with its XP check — the same one the plugin starts.
  const claim = await startOwnershipClaim({
    userId: session.userId,
    character: { rsn: account.rsn, rsnNormalized: normalizeRsn(account.rsn), accountHash: null },
  });
  if (claim.ok) {
    return NextResponse.json({ ok: true, claim: true, claimId: claim.claimId, status: claim.status, alreadyOpen: !claim.created, message: claim.message });
  }
  if (claim.reason === 'cooldown') return NextResponse.json({ ok: true, claim: false, alreadyOpen: true, message: claim.error });
  if (claim.reason !== 'hiscores') {
    return NextResponse.json({ error: claim.error }, { status: claim.reason === 'rate-limited' ? 429 : 409 });
  }

  // The XP check can't run: Anvil staff look, as a wrong-owner report. Which clan they were in when
  // they raised it, if any — context for staff, not a scope.
  const clan = await resolveClanFromRequest(request).catch(() => null);
  const { id, created } = await fileCharacterReport({
    accountId: account.id,
    clanId: clan?.id ?? null,
    reportedByUserId: session.userId,
    claimantPlayerId: session.playerId,
    kind: 'wrong_owner',
    body:
      `Raised from the website: this person says ${account.rsn} is theirs, but it is linked to someone else. ` +
      'Not proved: the XP check could not run (hiscores unavailable or unranked).' +
      (note ? `\n\nTheir note: ${note}` : ''),
  });
  return NextResponse.json({
    ok: true,
    claim: false,
    reportId: id,
    alreadyOpen: !created,
    message: 'Couldn’t run the XP check (the character has to be ranked on the hiscores), so this went to Anvil staff instead.',
  });
}
