import { NextResponse } from 'next/server';
import { db } from '@/db';
import { requireClan } from '@/lib/clanContext';
import { claimBlockedBy } from '@/lib/accountClaim';
import { accounts, clanAuditLog, clanMemberships, clanRoster } from '@/db/schema';
import { findOrCreateAccount, findOrCreateSeat, findRosterSeat } from '@/lib/roster';
import { and, eq } from 'drizzle-orm';
import { normalizeRsn, verifyUser } from '@/lib/auth';
import { onCharacterLinked } from '@/lib/identity';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';
import { admit } from '@/lib/guestAdmission';

const MAX_NOTE_LEN = 500;

// POST /api/auth/request-manual-review { rsn, note? }
// Last-resort path for users who can't use the plugin (no RuneLite) and can't use stat-delta
// (Hiscores opt-out, brand new account, etc). Creates or updates a clan_members row attached
// to the requesting user, marked provisional with method='manual'. The row lands in the
// moderator approval queue alongside stat-delta entries; the mod's note column shows the
// reason the user gave.
export async function POST(request: Request) {
  const session = await verifyUser();
  if (!session || session.userId <= 0) {
    return NextResponse.json({ error: 'Sign in with Discord first' }, { status: 401 });
  }
  const clan = await requireClan();

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
  if (!rsn || rsn.length < 1 || rsn.length > 12) {
    return NextResponse.json({ error: 'Provide a valid RSN' }, { status: 400 });
  }
  const note = (body.note || '').trim().slice(0, MAX_NOTE_LEN);
  const rsnNormalized = normalizeRsn(rsn);
  const nowIso = new Date().toISOString();

  // THIS CLAN'S seat, if there is one. The lookup carried no clan filter, so a request made in clan
  // A found a seat in clan B and then edited B's row — its notes, and its `leftAt`, reviving a seat
  // in a clan the person had left — while A got no request at all.
  const existing = await findRosterSeat(
    and(eq(clanRoster.clanId, clan.id), eq(clanRoster.rsnNormalized, rsnNormalized)),
  );

  // Hard block: somebody else already owns this RSN.
  //
  // Asked on `accounts` and in the right id space. This compared `existing.playerId` (a PERSON)
  // against `session.userId` (a LOGIN) — separate sequences, and on the preview data not one of the
  // sixty logins has id = player_id — and it could only see accounts holding a seat, so a character
  // owned by somebody currently in no clan read as unclaimed.
  const blocked = await claimBlockedBy(rsnNormalized, session.playerId);
  if (blocked) {
    return NextResponse.json(
      { error: 'This account is already linked to another user. Contact a moderator if you believe this is wrong.' },
      { status: 409 },
    );
  }

  let clanMemberId: number;

  if (existing) {
    // `session.playerId`, not `session.userId` — a LOGIN id was being written into a PERSON column,
    // which does not fail: it attaches the character to a real, unrelated person.
    //
    // Not routed through claimAccountForPerson, because asking for review is NOT a claim: nothing
    // has been proven yet. `verifiedAt` is deliberately left exactly as it was.
    await db
      .update(accounts)
      .set({
        playerId: session.playerId,
        verificationMethod: 'manual',
        provisional: 1,
        // Don't overwrite a real verifiedAt if this user is just adding context.
        verifiedAt: existing.verifiedAt,
        claimedAt: existing.claimedAt ?? nowIso,
      })
      .where(eq(accounts.id, existing.accountId));
    await db
      .update(clanMemberships)
      .set({
        notes: note || existing.notes,
        // Bring soft-deleted ghosts back into the active set on claim, unless an admin
        // had removed them.
        leftAt: existing.source === 'admin' ? existing.leftAt : null,
      })
      .where(eq(clanMemberships.id, existing.id));
    clanMemberId = existing.id;
  } else {
    const account = await findOrCreateAccount({ rsn, rsnNormalized });
    await db
      .update(accounts)
      .set({
        playerId: session.playerId,
        verificationMethod: 'manual',
        provisional: 1,
        claimedAt: nowIso,
      })
      .where(eq(accounts.id, account.id));
    // Asking for review proves nothing yet, and would not grant membership even once granted.
    // Linking a character is a claim about WHO YOU ARE, not a claim on this clan's roster. Under
    // the default policy this raises a request instead of seating them; the account is still linked
    // to them either way, which is what they actually asked for.
    const admission = await admit({ clanId: clan.id, accountId: account.id });
    if (admission.outcome !== 'seated') {
      return NextResponse.json(
        {
          error:
            admission.outcome === 'refused'
              ? 'This clan is not taking guests.'
              : 'Sent to this clan’s staff — you’ll appear once they accept.',
          admission: admission.outcome,
        },
        { status: admission.outcome === 'refused' ? 403 : 202 },
      );
    }
    clanMemberId = admission.seatId;
    await db
      .update(clanMemberships)
      .set({ lastSeenInClan: nowIso, notes: note || null })
      .where(eq(clanMemberships.id, clanMemberId));
  }

  // Character now has an owner: adopt its guest sign-ups.
  await onCharacterLinked(clanMemberId, session.userId);

  db.insert(clanAuditLog)
    .values({
      clanMemberId,
      eventType: 'manual_requested',
      newValue: JSON.stringify({ userId: session.userId, rsn }),
      actorUserId: session.userId,
      notes: note || null,
    })
    .catch(() => {});

  return NextResponse.json({ success: true, clanMemberId, status: 'pending_review' });
}
