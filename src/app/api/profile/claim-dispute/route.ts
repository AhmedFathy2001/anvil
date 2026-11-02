import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { accounts } from '@/db/schema';
import { normalizeRsn, verifyUser } from '@/lib/auth';
import { fileCharacterReport } from '@/lib/characterReports';
import { resolveClanFromRequest } from '@/lib/clanContext';
import { rateLimitByKey } from '@/lib/rate-limit';

// POST /api/profile/claim-dispute { rsn, note? } — "This is my character — report it".
//
// The site's twin of the plugin's "It's mine" (/api/plugin/account, action 'dispute'). Linking a
// character that somebody else already holds used to end at "Ask a moderator", which on the apex
// names nobody and in a clan names somebody who can no longer change a character anyway — character
// ownership is decided by Anvil staff in /staff/reports. This files that report, with the signed-in
// person as the claimant, so the dead end becomes a queue somebody actually reads.
//
// Idempotent through fileCharacterReport: pressing it twice (or once here and once in the plugin)
// adds to one open report rather than starting a second. Nothing about the character changes here.
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

  // Which clan they were in when they raised it, if any — context for staff, not a scope.
  const clan = await resolveClanFromRequest(request).catch(() => null);
  const { id, created } = await fileCharacterReport({
    accountId: account.id,
    clanId: clan?.id ?? null,
    reportedByUserId: session.userId,
    claimantPlayerId: session.playerId,
    kind: 'wrong_owner',
    body:
      `Raised from the website: this person says ${account.rsn} is theirs, but it is linked to someone else. ` +
      'Name only — no plugin or XP proof yet.' +
      (note ? `\n\nTheir note: ${note}` : ''),
  });
  return NextResponse.json({ ok: true, reportId: id, alreadyOpen: !created });
}
