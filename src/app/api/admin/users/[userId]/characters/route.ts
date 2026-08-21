import { NextResponse } from 'next/server';
import { db } from '@/db';
import { requireClan } from '@/lib/clanContext';
import { accounts, clanAuditLog, clanMemberships, clanRoster, users } from '@/db/schema';
import { findOrCreateAccount, findOrCreateSeat, findRosterSeat, personOfOrCreate } from '@/lib/roster';
import { and, eq } from 'drizzle-orm';
import { verifyUser, normalizeRsn, sanitizeRsn } from '@/lib/auth';
import { onCharacterLinked } from '@/lib/identity';
import { atLeast } from '@/lib/clanRoles';

// POST /api/admin/users/[userId]/characters   Body: { rsn }
//
// Admin attaches a game account (character) to a site user. An admin is a trusted actor, so this
// bypasses the RSN/hash proof gate the self-service claim needs — the admin is asserting the link.
// Refuses an RSN already owned by a DIFFERENT user (remove it there first) so links never silently
// move between people.
export async function POST(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const actor = await verifyUser();
  if (!actor || !atLeast(actor.role, 'admin')) return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  const clan = await requireClan();

  const { userId: idParam } = await params;
  const targetId = Number(idParam);
  if (!Number.isInteger(targetId)) return NextResponse.json({ error: 'Invalid user id' }, { status: 400 });

  let body: { rsn?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const rsn = sanitizeRsn(body.rsn || '');
  if (!rsn) return NextResponse.json({ error: 'rsn required' }, { status: 400 });
  const normalizedRsn = normalizeRsn(rsn);

  const target = await db.query.users.findFirst({ where: eq(users.id, targetId), columns: { id: true } });
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const nowIso = new Date().toISOString();

  // The PERSON behind this login. Needed before the guard below, not just for the writes — see the
  // id-space note there. Creating one for a user who lacks it is right regardless of how this ends:
  // every login needs a person, and the alternative is comparing against null.
  const targetPersonId = await personOfOrCreate(targetId);

  // TWO QUESTIONS, TWO SCOPES, and conflating them is what made this wrong in both directions.
  //
  // OWNERSHIP IS GLOBAL. `accounts.rsn_normalized` is unique platform-wide — one OSRS account, one
  // row, one owner, wherever they play. So "is this character already somebody's?" must be asked of
  // `accounts`, never of a roster: asking a clan's roster misses an owner who plays elsewhere, and
  // the branch below would then hand their account to this login, since findOrCreateAccount returns
  // the existing global row and the next line overwrites its player_id. That is account theft, not
  // a scoping nit.
  //
  // TWO ID SPACES, and they are not interchangeable. `playerId` names a PERSON; `targetId` came off
  // the URL and names a LOGIN, and the rest of this function knows it — every write converts with
  // personOfOrCreate first. Comparing them directly worked by luck: on the real data 59 of 60 users
  // have a person of the same number. Where they diverge the dangerous direction is a false MATCH,
  // which skips this guard entirely.
  const ownedAccount = await db.query.accounts.findFirst({
    where: eq(accounts.rsnNormalized, normalizedRsn),
    columns: { playerId: true },
  });
  if (ownedAccount?.playerId != null && ownedAccount.playerId !== targetPersonId) {
    return NextResponse.json(
      { error: 'That RSN is already linked to another site user — remove it there first.' },
      { status: 409 },
    );
  }

  // THE SEAT IS PER CLAN, and this one is only ever used to revive or reuse a seat HERE. Unscoped it
  // searched every roster on the platform, and the membership update below then set `leftAt` on
  // whatever it found — an admin of clan A reviving a seat in clan B.
  const existing = await findRosterSeat(
    and(eq(clanRoster.clanId, clan.id), eq(clanRoster.rsnNormalized, normalizedRsn)),
  );

  let clanMemberId: number;
  if (existing) {
    await db
      .update(accounts)
      .set({
        playerId: targetPersonId,
        verifiedAt: existing.verifiedAt ?? nowIso,
        verificationMethod: 'manual',
        provisional: 0,
        claimedAt: existing.claimedAt ?? nowIso,
      })
      .where(eq(accounts.id, existing.accountId));
    await db
      .update(clanMemberships)
      .set({ leftAt: existing.source === 'admin' ? existing.leftAt : null })
      .where(eq(clanMemberships.id, existing.id));
    clanMemberId = existing.id;
  } else {
    const account = await findOrCreateAccount({ rsn, rsnNormalized: normalizedRsn });
    await db
      .update(accounts)
      .set({
        playerId: targetPersonId,
        verifiedAt: nowIso,
        verificationMethod: 'manual',
        provisional: 0,
        claimedAt: nowIso,
      })
      .where(eq(accounts.id, account.id));
    clanMemberId = await findOrCreateSeat(clan.id, account.id, { kind: 'guest', source: 'admin' });
  }

  // Adopt any guest sign-ups this character already had (created before it was attached to a person),
  // so the Sign-ups panel stops showing them as "guest · no Discord" now that we know the owner.
  await onCharacterLinked(clanMemberId, targetId);

  db.insert(clanAuditLog)
    .values({
      clanMemberId,
      eventType: 'claimed',
      newValue: JSON.stringify({ userId: targetId, via: 'admin', rsn }),
      actorUserId: actor.userId,
    })
    .catch(() => {});

  return NextResponse.json({ ok: true, clanMemberId });
}
