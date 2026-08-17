import { NextResponse } from 'next/server';
import { db } from '@/db';
import { requireClan } from '@/lib/clanContext';
import { users, clanMembers, clanAuditLog } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyUser, normalizeRsn, sanitizeRsn } from '@/lib/auth';
import { onCharacterLinked } from '@/lib/identity';

// POST /api/admin/users/[userId]/characters   Body: { rsn }
//
// Admin attaches a game account (character) to a site user. An admin is a trusted actor, so this
// bypasses the RSN/hash proof gate the self-service claim needs — the admin is asserting the link.
// Refuses an RSN already owned by a DIFFERENT user (remove it there first) so links never silently
// move between people.
export async function POST(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const actor = await verifyUser();
  if (actor?.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 });
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
  const existing = await db.query.clanMembers.findFirst({ where: eq(clanMembers.rsnNormalized, normalizedRsn) });

  if (existing?.userId != null) {
    if (existing.userId === targetId) return NextResponse.json({ ok: true, clanMemberId: existing.id });
    return NextResponse.json(
      { error: 'That RSN is already linked to another site user — remove it there first.' },
      { status: 409 },
    );
  }

  let clanMemberId: number;
  if (existing) {
    await db
      .update(clanMembers)
      .set({
        userId: targetId,
        verifiedAt: existing.verifiedAt ?? nowIso,
        verificationMethod: 'manual',
        provisional: 0,
        claimedAt: existing.claimedAt ?? nowIso,
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
        rsnNormalized: normalizedRsn,
        source: 'manual',
        userId: targetId,
        isGuest: 1,
        verifiedAt: nowIso,
        verificationMethod: 'manual',
        provisional: 0,
        claimedAt: nowIso,
      })
      .returning({ id: clanMembers.id });
    clanMemberId = inserted[0].id;
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
