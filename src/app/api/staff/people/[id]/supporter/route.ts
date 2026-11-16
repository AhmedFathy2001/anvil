import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { users } from '@/db/schema';
import { CAN_GRANT, requirePlatformApi } from '@/lib/platformAccess';
import { syncAnvilSupporterRoles } from '@/lib/anvilDiscord';
import { MAX_GIFT_DAYS, endGift, giveGift, isGiftTier, listGifts, previewGift, standingForPlayer, type GiftMode } from '@/lib/supporterGifts';

// /api/staff/people/<playerId>/supporter — free Supporter time from Anvil staff (lib/supporterGifts).
//   Every answer is { gifts, standing }: their gifts (with who gave / ended each, from the audit log)
//   and what they pay for vs. wear now (lib/supporterGiftRules supporterStanding).
//   GET                          this person's gifts
//   GET ?tier=&days=&mode=       the same, plus `preview`: what that gift WOULD do, in plain words,
//                                for the form to show before saving ({ text, nothing, blocked })
//   POST { tier, days, mode?, note?, boostSlots?, confirm? }
//                                give one. mode 'lift' (default, what a gift always was): at least
//                                this tier until then, over whatever they pay for. mode 'add': the
//                                days are ADDED to what they hold at the tier (lib/supporterGiftRules
//                                planAddTime). A lift that would change nothing visible answers 409
//                                { needsConfirm } until sent again with confirm: true. boostSlots
//                                (default false) also gives the tier's clan boost slots.
//   Never writes to or calls Gumroad: a paid membership and its charges are not touched.
//   DELETE ?gift=<id>            end one now
// Root only, like platform roles: it hands out what people otherwise pay for. Their Anvil Discord
// role follows at once (the role sweep would catch it later anyway). A gift isn't announced in the
// "new supporters" channel: nobody bought anything.

async function loginFor(params: Promise<{ id: string }>) {
  const playerId = Number((await params).id);
  if (!Number.isInteger(playerId) || playerId <= 0) return null;
  const login = await db.query.users.findFirst({ where: eq(users.playerId, playerId), columns: { id: true } });
  return login ? { id: login.id, playerId } : null;
}

async function answer(login: { id: number; playerId: number }) {
  const [gifts, standing] = await Promise.all([listGifts(login.id), standingForPlayer(login.playerId)]);
  return NextResponse.json({ gifts, standing });
}

const noLogin = () => NextResponse.json({ error: 'That person has no Discord login to give Supporter to.' }, { status: 400 });

const modeOf = (v: unknown): GiftMode => (v === 'add' ? 'add' : 'lift');
const daysOf = (v: unknown) => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  return Number.isInteger(n) && n >= 1 && n <= MAX_GIFT_DAYS ? n : null;
};

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requirePlatformApi(CAN_GRANT);
  if ('response' in gate) return gate.response;
  const login = await loginFor(params);
  if (!login) return noLogin();
  const q = new URL(request.url).searchParams;
  const tier = q.get('tier');
  const days = daysOf(q.get('days'));
  if (!isGiftTier(tier) || days == null) return answer(login);
  const [gifts, standing, preview] = await Promise.all([
    listGifts(login.id),
    standingForPlayer(login.playerId),
    previewGift({ userId: login.id, playerId: login.playerId, tier, days, mode: modeOf(q.get('mode')) }),
  ]);
  return NextResponse.json({ gifts, standing, preview });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requirePlatformApi(CAN_GRANT);
  if ('response' in gate) return gate.response;
  const login = await loginFor(params);
  if (!login) return noLogin();
  const body = (await request.json().catch(() => null)) as { tier?: unknown; days?: unknown; note?: unknown; boostSlots?: unknown; mode?: unknown; confirm?: unknown } | null;
  if (!body || !isGiftTier(body.tier)) return NextResponse.json({ error: 'Pick a tier.' }, { status: 400 });
  const days = daysOf(body.days);
  if (days == null) {
    return NextResponse.json({ error: `A gift runs 1 to ${MAX_GIFT_DAYS} days.` }, { status: 400 });
  }
  const mode = modeOf(body.mode);
  const preview = await previewGift({ userId: login.id, playerId: login.playerId, tier: body.tier, days, mode });
  if (preview.blocked) return NextResponse.json({ error: preview.text }, { status: 409 });
  // A lift that changes nothing they can see is only made on a second, deliberate click.
  if (preview.nothing && body.confirm !== true) return NextResponse.json({ error: preview.text, needsConfirm: true }, { status: 409 });
  await giveGift({
    userId: login.id,
    tier: body.tier,
    days,
    mode,
    actorUserId: gate.actor.user.userId,
    note: typeof body.note === 'string' ? body.note : null,
    boostSlots: body.boostSlots === true,
  });
  void syncAnvilSupporterRoles(login.id);
  return answer(login);
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
  return answer(login);
}
