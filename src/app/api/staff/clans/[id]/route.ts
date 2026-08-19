import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { clans, clanAuditLog } from '@/db/schema';
import { requirePlatformApi, CAN_WRITE } from '@/lib/platformAccess';
import { PLANS, isPlanId } from '@/lib/plans';

/**
 * Clan lifecycle, the platform half.
 *
 * What an operator may change here is deliberately narrow: the things that belong to running the
 * platform (does this clan serve, what is it entitled to, what is it called and where does it live)
 * and nothing that belongs to running the clan. There is no route here that touches a clan's events,
 * roster, boards or settings — that is the clan's, and reaching it requires the clan's own grant.
 *
 * Guarded here rather than by middleware, which never covers /api/*.
 */

const STATUSES = new Set(['active', 'suspended', 'archived']);

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requirePlatformApi(CAN_WRITE);
  if ('response' in gate) return gate.response;
  const { actor } = gate;

  const clanId = Number((await params).id);
  if (!Number.isInteger(clanId) || clanId <= 0) {
    return NextResponse.json({ error: 'Bad clan id' }, { status: 400 });
  }

  const before = await db.query.clans.findFirst({ where: eq(clans.id, clanId) });
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Bad body' }, { status: 400 });
  }

  const patch: Partial<typeof clans.$inferInsert> = {};

  if ('status' in body) {
    if (!STATUSES.has(body.status)) return NextResponse.json({ error: 'Bad status' }, { status: 400 });
    patch.status = body.status;
  }
  if ('plan' in body) {
    // Validated against the one plan vocabulary rather than a copy of it, so a tier added in
    // lib/plans is immediately settable here instead of silently rejected.
    const plan = String(body.plan ?? '');
    if (!isPlanId(plan)) return NextResponse.json({ error: 'Bad plan' }, { status: 400 });
    patch.plan = plan;
    // The cap follows the plan unless this same request overrides it. An operator moving a clan to
    // Silver means the Silver cap; leaving a stale cap behind is the bug this prevents.
    if (!('memberCap' in body)) patch.memberCap = PLANS[plan].memberCap;
  }
  if ('name' in body) {
    const name = String(body.name ?? '').trim();
    if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });
    patch.name = name;
  }
  if ('memberCap' in body) {
    // null is meaningful: no cap. Distinguished from absent, which means leave it alone.
    if (body.memberCap === null) patch.memberCap = null;
    else {
      const cap = Number(body.memberCap);
      if (!Number.isInteger(cap) || cap <= 0) {
        return NextResponse.json({ error: 'Cap must be a positive integer or null' }, { status: 400 });
      }
      patch.memberCap = cap;
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to change' }, { status: 400 });
  }

  const [after] = await db.update(clans).set(patch).where(eq(clans.id, clanId)).returning();

  // Logged into the CLAN's own audit log, not a separate operator log the clan cannot see. A
  // platform action on a clan is something that clan's owner is entitled to find out about.
  await db
    .insert(clanAuditLog)
    .values({
      clanId,
      eventType: 'platform_clan_updated',
      actorUserId: actor.user.userId,
      oldValue: JSON.stringify(
        Object.fromEntries(Object.keys(patch).map((k) => [k, (before as Record<string, unknown>)[k]])),
      ),
      newValue: JSON.stringify(patch),
      notes: `platform ${actor.role}`,
    })
    .catch(() => {});

  return NextResponse.json({ ok: true, clan: after });
}
