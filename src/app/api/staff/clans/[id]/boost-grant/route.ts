import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { db } from '@/db';
import { clanAuditLog, clanBoostState, clans } from '@/db/schema';
import { CAN_WRITE, requirePlatformApi } from '@/lib/platformAccess';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requirePlatformApi(CAN_WRITE);
  if ('response' in gate) return gate.response;
  const clanId = Number((await params).id);
  const body = await request.json().catch(() => null) as { level?: unknown; days?: unknown } | null;
  const level = Number(body?.level);
  if (!Number.isInteger(clanId) || clanId <= 0 || !Number.isInteger(level) || level < 0 || level > 3) {
    return NextResponse.json({ error: 'Choose a boost tier from 0 to 3.' }, { status: 400 });
  }
  if (!(await db.query.clans.findFirst({ where: eq(clans.id, clanId), columns: { id: true } }))) {
    return NextResponse.json({ error: 'Clan not found.' }, { status: 404 });
  }
  let expiresAt: string | null = null;
  if (level > 0 && body?.days !== null && body?.days !== '' && body?.days !== undefined) {
    const days = Number(body.days);
    if (!Number.isInteger(days) || days < 1 || days > 3650) return NextResponse.json({ error: 'Days must be 1–3650, or blank for indefinitely.' }, { status: 400 });
    expiresAt = new Date(Date.now() + days * 86_400_000).toISOString();
  }
  const values = level === 0
    ? { giftLevel: null, giftExpiresAt: null, giftedBy: null, updatedAt: new Date().toISOString() }
    : { giftLevel: level, giftExpiresAt: expiresAt, giftedBy: gate.actor.user.userId, updatedAt: new Date().toISOString() };
  await db.insert(clanBoostState).values({ clanId, ...values }).onConflictDoUpdate({ target: clanBoostState.clanId, set: values });
  await db.insert(clanAuditLog).values({
    clanId,
    eventType: level ? 'platform_boost_gifted' : 'platform_boost_gift_cleared',
    actorUserId: gate.actor.user.userId,
    newValue: JSON.stringify({ level, expiresAt }),
    notes: `platform ${gate.actor.role}`,
  }).catch(() => {});
  return NextResponse.json({ ok: true, level, expiresAt });
}
