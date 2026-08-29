import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { clans, events } from '@/db/schema';
import { eventForRequest } from '@/lib/eventScope';
import { verifyUser } from '@/lib/auth';
import { atLeast } from '@/lib/clanRoles';
import { cohostsForEvent, inviteCoHost } from '@/lib/coHost';
import { settlementForEvent } from '@/lib/coHostSettlement';
import { clanCan, minPlanNameFor } from '@/lib/entitlements';

export const CASH_POLICIES = ['host-holds', 'each-settles', 'clans-collect-host-pays'] as const;
export type CashPolicy = (typeof CASH_POLICIES)[number];

/**
 * The co-hosts on an event, and inviting a clan to be one.
 *
 * HOST-admin only — bringing another clan onto your board is a host decision. `eventForRequest` ties
 * the event to the clan whose site this is, so an admin of one clan can't co-host another's event.
 */
export async function GET(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const eventId = Number((await params).eventId);
  const event = await eventForRequest(request, eventId);
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({
    cohosts: await cohostsForEvent(eventId),
    cashPolicy: event.cashPolicy,
    settlement: await settlementForEvent(eventId),
  });
}

/** Set who holds the cash (host-admin). */
export async function PATCH(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const session = await verifyUser();
  if (!session || !atLeast(session.role, 'admin')) return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  const eventId = Number((await params).eventId);
  const event = await eventForRequest(request, eventId);
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json().catch(() => null);
  const cashPolicy = body?.cashPolicy;
  if (!(CASH_POLICIES as readonly string[]).includes(cashPolicy)) {
    return NextResponse.json({ error: 'Unknown cash policy' }, { status: 400 });
  }
  await db.update(events).set({ cashPolicy }).where(eq(events.id, eventId));
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const session = await verifyUser();
  if (!session || !atLeast(session.role, 'admin')) return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  const eventId = Number((await params).eventId);
  const event = await eventForRequest(request, eventId);
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // "Free to join, paid to host": hosting a co-hosted event is a premium capability. Generous now —
  // clanCan is true for everyone until FREEMIUM_ENFORCED flips (lib/entitlements) — so this door is
  // wired but does not bite yet.
  const host = await db.query.clans.findFirst({ where: eq(clans.id, event.clanId), columns: { plan: true } });
  if (!clanCan(host?.plan, 'host-multi-clan')) {
    return NextResponse.json(
      { error: `Hosting a multi-clan event is a ${minPlanNameFor('host-multi-clan')} feature.`, upgrade: true },
      { status: 402 },
    );
  }

  const body = await request.json().catch(() => null);
  const clanSlug = typeof body?.clanSlug === 'string' ? body.clanSlug.trim().toLowerCase() : '';
  if (!clanSlug) return NextResponse.json({ error: 'Which clan?' }, { status: 400 });

  const target = await db.query.clans.findFirst({ where: eq(clans.slug, clanSlug) });
  if (!target) return NextResponse.json({ error: 'No clan with that address' }, { status: 404 });
  if (target.id === event.clanId) return NextResponse.json({ error: 'That clan is the host' }, { status: 400 });

  const { id, created } = await inviteCoHost(eventId, target.id, session.userId);
  return NextResponse.json({ ok: true, id, created });
}
