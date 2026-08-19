import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { clans } from '@/db/schema';
import { requirePlatformApi, CAN_WRITE } from '@/lib/platformAccess';
import { grantActAs, revokeActAs, myLiveGrants, MAX_HOURS, DEFAULT_HOURS } from '@/lib/actAs';

/**
 * Taking and handing back a temporary grant inside a clan.
 *
 * A REASON IS REQUIRED, and not as ceremony: it is what lands in the clan's own audit log, and it
 * is the difference between the clan being able to see that an operator acted and merely being able
 * to see that something changed.
 */

export async function GET() {
  const gate = await requirePlatformApi('support');
  if ('response' in gate) return gate.response;
  return NextResponse.json({ grants: await myLiveGrants(gate.actor.user.userId) });
}

export async function POST(request: Request) {
  const gate = await requirePlatformApi(CAN_WRITE);
  if ('response' in gate) return gate.response;
  const { actor } = gate;

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Bad body' }, { status: 400 });

  const clanId = Number(body.clanId);
  if (!Number.isInteger(clanId) || clanId <= 0) {
    return NextResponse.json({ error: 'Bad clan id' }, { status: 400 });
  }
  const clan = await db.query.clans.findFirst({ where: eq(clans.id, clanId) });
  if (!clan) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const reason = String(body.reason ?? '').trim();
  if (reason.length < 8) {
    // Deliberately not optional and deliberately not satisfiable with "fix". The clan's owner reads
    // this line and it is the only account they get of why someone was in their data.
    return NextResponse.json({ error: 'Give a reason (at least 8 characters)' }, { status: 400 });
  }

  const hours = Number(body.hours ?? DEFAULT_HOURS);
  if (!Number.isFinite(hours) || hours < 1 || hours > MAX_HOURS) {
    return NextResponse.json({ error: `Hours must be 1–${MAX_HOURS}` }, { status: 400 });
  }

  const grant = await grantActAs({
    clanId,
    userId: actor.user.userId,
    reason,
    hours,
    actorRole: actor.role,
  });
  return NextResponse.json({ ok: true, grant });
}

export async function DELETE(request: Request) {
  const gate = await requirePlatformApi(CAN_WRITE);
  if ('response' in gate) return gate.response;

  const body = await request.json().catch(() => null);
  const id = Number(body?.id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'Bad id' }, { status: 400 });

  const done = await revokeActAs(id, gate.actor.user.userId);
  if (!done) return NextResponse.json({ error: 'No such live grant of yours' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
