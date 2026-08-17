import { NextResponse } from 'next/server';
import { db } from '@/db';
import { requireClan } from '@/lib/clanContext';
import { clanAuditLog, clanMembers } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { normalizeRsn, verifyUser } from '@/lib/auth';
import { onCharacterLinked } from '@/lib/identity';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';

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

  const existing = await db.query.clanMembers.findFirst({
    where: eq(clanMembers.rsnNormalized, rsnNormalized),
  });

  // Hard block: another user already owns this RSN. Surface contact path so the user
  // doesn't keep retrying.
  if (existing?.userId && existing.userId !== session.userId) {
    return NextResponse.json(
      { error: 'This account is already linked to another user. Contact a moderator if you believe this is wrong.' },
      { status: 409 },
    );
  }

  let clanMemberId: number;

  if (existing) {
    await db
      .update(clanMembers)
      .set({
        userId: session.userId,
        verificationMethod: 'manual',
        provisional: 1,
        // Don't overwrite a real verifiedAt if this user is just adding context.
        verifiedAt: existing.verifiedAt,
        claimedAt: existing.claimedAt ?? nowIso,
        notes: note || existing.notes,
        // Bring soft-deleted ghosts back into the active set on claim, unless an admin
        // had manually removed them.
        leftAt: existing.source === 'manual' ? existing.leftAt : null,
      })
      .where(eq(clanMembers.id, existing.id));
    clanMemberId = existing.id;
  } else {
    const inserted = await db
      .insert(clanMembers)
      .values({
        clanId: clan.id,
        rsn,
        rsnNormalized,
        source: 'manual',
        // Verification proves account ownership, not clan membership. Start as a guest;
        // clan-sync promotes to member (isGuest=0) only when the in-game roster includes them.
        isGuest: 1,
        lastSeenInClan: nowIso,
        userId: session.userId,
        verificationMethod: 'manual',
        provisional: 1,
        claimedAt: nowIso,
        notes: note || null,
      })
      .returning({ id: clanMembers.id });
    clanMemberId = inserted[0].id;
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
