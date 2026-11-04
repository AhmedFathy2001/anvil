import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { users } from '@/db/schema';
import { CAN_GRANT, requirePlatformApi } from '@/lib/platformAccess';
import { syncAnvilSupporterRoles } from '@/lib/anvilDiscord';
import { MAX_GIFT_DAYS, endGift, giveGift, isGiftTier, listGifts } from '@/lib/supporterGifts';

// /api/staff/people/<playerId>/supporter — free Supporter time from Anvil staff (lib/supporterGifts).
//   GET                          this person's gifts
//   POST { tier, days, note?, boostSlots? }   give one; boostSlots (default false) also gives the
//                                tier's clan boost slots (lib/clanBoostRules slotTier)
//   DELETE ?gift=<id>            end one now
// Root only, like platform roles: it hands out what people otherwise pay for. Their Anvil Discord
// role follows at once (the role sweep would catch it later anyway). A gift isn't announced in the
// "new supporters" channel: nobody bought anything.

async function loginFor(params: Promise<{ id: string }>) {
  const playerId = Number((await params).id);
  if (!Number.isInteger(playerId) || playerId <= 0) return null;
  return (await db.query.users.findFirst({ where: eq(users.playerId, playerId), columns: { id: true } })) ?? null;
}

const noLogin = () => NextResponse.json({ error: 'That person has no Discord login to give Supporter to.' }, { status: 400 });

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requirePlatformApi(CAN_GRANT);
  if ('response' in gate) return gate.response;
  const login = await loginFor(params);
  if (!login) return noLogin();
  return NextResponse.json({ gifts: await listGifts(login.id) });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requirePlatformApi(CAN_GRANT);
  if ('response' in gate) return gate.response;
  const login = await loginFor(params);
  if (!login) return noLogin();
  const body = (await request.json().catch(() => null)) as { tier?: unknown; days?: unknown; note?: unknown; boostSlots?: unknown } | null;
  if (!body || !isGiftTier(body.tier)) return NextResponse.json({ error: 'Pick a tier.' }, { status: 400 });
  const days = typeof body.days === 'number' ? body.days : NaN;
  if (!(days >= 1 && days <= MAX_GIFT_DAYS)) {
    return NextResponse.json({ error: `A gift runs 1 to ${MAX_GIFT_DAYS} days.` }, { status: 400 });
  }
  await giveGift({
    userId: login.id,
    tier: body.tier,
    days,
    actorUserId: gate.actor.user.userId,
    note: typeof body.note === 'string' ? body.note : null,
    boostSlots: body.boostSlots === true,
  });
  void syncAnvilSupporterRoles(login.id);
  return NextResponse.json({ gifts: await listGifts(login.id) });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requirePlatformApi(CAN_GRANT);
  if ('response' in gate) return gate.response;
  const login = await loginFor(params);
  if (!login) return noLogin();
  const gift = Number(new URL(request.url).searchParams.get('gift'));
  if (!Number.isInteger(gift) || gift <= 0) return NextResponse.json({ error: 'gift' }, { status: 400 });
  if (!(await endGift(login.id, gift, gate.actor.user.userId))) {
    return NextResponse.json({ error: 'No running gift with that id.' }, { status: 404 });
  }
  void syncAnvilSupporterRoles(login.id);
  return NextResponse.json({ gifts: await listGifts(login.id) });
}
