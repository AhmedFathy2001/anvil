import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';

import { db } from '@/db';
import { clanAuditLog, clanStaff, clans, users } from '@/db/schema';
import { requirePlatformApi, CAN_WRITE } from '@/lib/platformAccess';

/**
 * Give a clan an owner, but ONLY when it has none.
 *
 * THE DEADLOCK THIS EXISTS FOR. Ownership moves through the clan's own transfer flow, and that flow
 * requires a current owner to call it. A clan with no owner therefore cannot ever acquire one: no
 * undemotable seat, nothing for the transfer to move, and nobody inside the clan with the authority
 * to fix it. The only escape was the ADMIN_DISCORD_ID bootstrap, which names one specific person on
 * the whole deployment — no use to anyone else's clan. theafkspot came out of the migration in
 * exactly this state.
 *
 * SO IT IS AN UNSTICKING, NOT A POWER. The refusal to reassign an EXISTING owner is what keeps it
 * from being one: an operator can repair a clan that has nobody, and cannot take a clan away from
 * somebody. Those are different acts, and only the first belongs here.
 *
 * The candidate must already hold a grant in the clan, mirroring the transfer flow's own rule —
 * you do not hand the crown to someone who has never held staff access.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requirePlatformApi(CAN_WRITE);
  if ('response' in gate) return gate.response;
  const { actor } = gate;

  const clanId = Number((await params).id);
  if (!Number.isInteger(clanId) || clanId <= 0) {
    return NextResponse.json({ error: 'Bad clan id' }, { status: 400 });
  }
  const clan = await db.query.clans.findFirst({ where: eq(clans.id, clanId) });
  if (!clan) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const existing = await db.query.clanStaff.findFirst({
    where: and(eq(clanStaff.clanId, clanId), eq(clanStaff.role, 'owner')),
  });
  if (existing) {
    return NextResponse.json(
      { error: 'This clan already has an owner. Moving it is the clan’s own transfer flow.' },
      { status: 409 },
    );
  }

  const body = await request.json().catch(() => null);
  const userId = Number(body?.userId);
  if (!Number.isInteger(userId) || userId <= 0) {
    return NextResponse.json({ error: 'Bad user id' }, { status: 400 });
  }

  const target = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!target) return NextResponse.json({ error: 'No such user' }, { status: 404 });

  const grant = await db.query.clanStaff.findFirst({
    where: and(eq(clanStaff.clanId, clanId), eq(clanStaff.userId, userId)),
  });
  if (!grant) {
    return NextResponse.json(
      { error: 'That person holds no grant in this clan. Promote them there first.' },
      { status: 400 },
    );
  }

  await db
    .update(clanStaff)
    .set({ role: 'owner', canEditTiles: true })
    .where(and(eq(clanStaff.clanId, clanId), eq(clanStaff.userId, userId)));

  await db.insert(clanAuditLog).values({
    clanId,
    eventType: 'platform_owner_appointed',
    actorUserId: actor.user.userId,
    oldValue: JSON.stringify({ role: grant.role }),
    newValue: JSON.stringify({ role: 'owner', userId }),
    notes: `clan had no owner; appointed by platform ${actor.role}`,
  });

  return NextResponse.json({ ok: true, ownerUserId: userId });
}

/** Who could be made owner: anyone already holding a grant here. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requirePlatformApi('support');
  if ('response' in gate) return gate.response;

  const clanId = Number((await params).id);
  if (!Number.isInteger(clanId) || clanId <= 0) {
    return NextResponse.json({ error: 'Bad clan id' }, { status: 400 });
  }

  const rows = await db
    .select({ userId: clanStaff.userId, role: clanStaff.role, name: users.displayName })
    .from(clanStaff)
    .innerJoin(users, eq(users.id, clanStaff.userId))
    .where(eq(clanStaff.clanId, clanId));

  return NextResponse.json({
    hasOwner: rows.some((r) => r.role === 'owner'),
    candidates: rows.filter((r) => r.role !== 'owner'),
  });
}
