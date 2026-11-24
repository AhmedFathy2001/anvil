import { NextResponse } from 'next/server';

import { clanGuideActor } from '@/lib/guideAccess';
import { bad, publishedGuide, readJson, refusal, signedIn } from '@/lib/guideApi';
import { communitySetups, submitSetup } from '@/lib/guideCommunity';

type Ctx = { params: Promise<{ id: string }> };

// GET — the community setups a reader of this guide sees (the library's, plus this clan's pins).
export async function GET(_req: Request, ctx: Ctx) {
  const guide = await publishedGuide((await ctx.params).id);
  if (!guide) return bad('Not found', 404);
  return NextResponse.json({ setups: await communitySetups(guide, null) });
}

// POST — submit a setup to a level: { tier, setup, notes?, clanOnly? }. Live at once as community;
// clanOnly (clan guide editors only, on their own copy) pins it to the clan's copy instead.
export async function POST(request: Request, ctx: Ctx) {
  const gate = await signedIn('submit', 10, 3_600_000);
  if ('response' in gate) return gate.response;
  const guide = await publishedGuide((await ctx.params).id);
  if (!guide) return bad('Not found', 404);
  const body = await readJson(request);
  if (!body) return bad('Bad request');
  let clanId: number | null = null;
  if (body.clanOnly === true) {
    const actor = await clanGuideActor();
    if (!actor?.canEdit || guide.clanId !== actor.clan.id) return bad('Only your clan’s guide editors can pin a clan setup.', 403);
    clanId = actor.clan.id;
  }
  try {
    const row = await submitSetup({ guideId: guide.id, userId: gate.user.userId, tier: String(body.tier ?? ''), setup: body.setup, notes: typeof body.notes === 'string' ? body.notes : null, clanId });
    return NextResponse.json({ id: row.id, firstToWrite: row.firstToWrite });
  } catch (err) {
    return refusal(err);
  }
}
