import { NextResponse } from 'next/server';
import { db } from '@/db';
import { currentClan } from '@/lib/clanContext';
import { claimAccountForPerson, claimBlockedBy } from '@/lib/accountClaim';
import { accounts, clanAuditLog, clanMemberships, clanRoster, clans } from '@/db/schema';
import { findRosterSeat } from '@/lib/roster';
import { and, eq, isNull } from 'drizzle-orm';
import { normalizeRsn, verifyUser } from '@/lib/auth';
import { onCharacterLinked } from '@/lib/identity';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';
import { admit } from '@/lib/guestAdmission';
import { isBannedFromClan } from '@/lib/clanBans';
import { rosterClanSeat } from '@/lib/seatScope';

const MAX_NOTE_LEN = 500;
/** Open (unconfirmed) manual claims one person may hold at once. */
const MAX_OPEN_MANUAL_CLAIMS = 3;

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
  // NOT requireClan(). Claiming a character is a fact about the PERSON, not about a clan — which is
  // why verify-stat-delta/check resolves a nullable clan for exactly the same reason. Insisting on
  // one here made this unreachable from the apex, and the apex is the ONLY place a member of a
  // private clan can stand: canSeeClan needs a seat joined through accounts.player_id, and an
  // unclaimed character has none. So the people who most need the "a mod vouches for me" path —
  // maxed accounts with no XP to gain, anyone who cannot log in right now — were the people it
  // refused. Null selects the claim-only path; a clan, when there is one, still gets its seat.
  let clan: { id: number } | null = await currentClan();

  // Manual claims sit in a mod queue forever once submitted, so a tighter limit
  // discourages spam without blocking legitimate retries.
  const rl = await rateLimit(request, 'manual-review-request', { limit: 5, windowMs: 60 * 60 * 1000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many requests — try again later.' },
      { status: 429, headers: rateLimitHeaders(rl) },
    );
  }

  let body: { rsn?: string; note?: string; clan?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // This is a platform route, so a clan page names its clan in the body (its address path, `/c/<slug>`).
  // Only a clan that exists counts; nothing else is read from it.
  if (!clan && typeof body.clan === 'string') {
    const m = /^\/([cs])\/([a-z0-9-]{2,32})$/.exec(body.clan);
    if (m) {
      clan = (await db.query.clans.findFirst({
        where: and(eq(clans.slug, m[2]), eq(clans.kind, m[1] === 's' ? 'creator' : 'clan')),
      })) ?? null;
    }
  }
  // Nobody to review it without a clan: a claim nobody can confirm would sit unconfirmed for ever, so
  // it is not accepted here. The XP check and the plugin are the ways in away from a clan's page.
  if (!clan) {
    return NextResponse.json(
      { error: 'Staff review is asked for from a clan’s own page, so that clan’s staff can see it. Here, use the XP check or the plugin.' },
      { status: 400 },
    );
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
  const existing = clan
    // The clan seat; an event player's seat is never revived or treated as one (admit() is the door).
    ? await findRosterSeat(and(eq(clanRoster.clanId, clan.id), eq(clanRoster.rsnNormalized, rsnNormalized), rosterClanSeat()))
    : null;

  // BANNED: refused as everywhere else, before anything is claimed.
  if (session.playerId != null && (await isBannedFromClan(clan.id, session.playerId))) {
    return NextResponse.json({ error: 'This clan has barred you.' }, { status: 403 });
  }

  // THE IN-GAME LIST IS THE ONLY SOURCE OF A SEAT. A character already on this clan's roster belongs to
  // somebody the game says is in the clan: a web request must not hand it to a stranger. Whoever really
  // plays it links it by playing with the plugin signed in (the first-use link) or by the XP check.
  if (existing && existing.playerId !== session.playerId) {
    return NextResponse.json(
      { error: 'That character is on this clan’s in-game list. Play it once with the Anvil plugin signed in and it links to you, or use the XP check.' },
      { status: 409 },
    );
  }

  // One person, a few open claims at a time: a name each, never a string of other people's.
  if (session.playerId != null) {
    const open = await db
      .select({ id: accounts.id, rsnNormalized: accounts.rsnNormalized })
      .from(accounts)
      .where(and(eq(accounts.playerId, session.playerId), isNull(accounts.verifiedAt), eq(accounts.provisional, 1), eq(accounts.verificationMethod, 'manual')));
    if (!open.some((a) => a.rsnNormalized === rsnNormalized) && open.length >= MAX_OPEN_MANUAL_CLAIMS) {
      return NextResponse.json(
        { error: `You already have ${MAX_OPEN_MANUAL_CLAIMS} characters waiting for staff review. Wait for an answer before asking for another.` },
        { status: 429 },
      );
    }
  }

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

  // This is intentionally provisional: the requester has asserted ownership and a moderator still
  // has to vouch. Use the same claim transaction as XP/plugin anyway, so an older roster placeholder
  // is folded into the Discord person's row instead of being stranded when player_id changes.
  const claim = await claimAccountForPerson({
    playerId: session.playerId,
    rsn,
    rsnNormalized,
    method: 'manual',
    verified: false,
    provisional: true,
    actorUserId: session.userId,
  });
  if (!claim.ok) return NextResponse.json({ error: claim.error }, { status: 409 });

  let clanMemberId: number;

  if (existing) {
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
    // Asking for review proves nothing yet, and would not grant membership even once granted.
    // Linking a character is a claim about WHO YOU ARE, not a claim on this clan's roster. Under
    // the default policy this raises a request instead of seating them; the account is still linked
    // to them either way, which is what they actually asked for.
    // No clan named — the apex, where the claim is the whole request and there is no roster to join.
    // The character is linked to them either way, which is what they actually asked for; a seat, if
    // they want one, comes from the clan's own door.
    if (!clan) {
      return NextResponse.json({ ok: true, claimed: true, provisional: true });
    }

    const admission = await admit({
      clanId: clan.id,
      accountId: claim.accountId,
      source: 'web',
      message: `Asked staff to vouch for ${rsn} (no plugin or XP check).${note ? ` ${note}` : ''}`.slice(0, 400),
    });
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
