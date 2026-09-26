import { NextResponse } from 'next/server';

import { verifyUser } from '@/lib/auth';
import { GuideInputError } from '@/lib/guides';
import { getProposal, updateProposal, withdrawProposal } from '@/lib/guideProposals';

type Ctx = { params: Promise<{ id: string }> };

/** The caller's own proposal, or null — someone else's reads as not found. */
async function own(ctx: Ctx) {
  const user = await verifyUser();
  if (!user) return null;
  const p = await getProposal(Number((await ctx.params).id));
  return p && p.proposerUserId === user.userId ? p : null;
}

export async function GET(_req: Request, ctx: Ctx) {
  const p = await own(ctx);
  if (!p) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ proposal: p });
}

// PATCH — edit while it waits.
export async function PATCH(request: Request, ctx: Ctx) {
  const p = await own(ctx);
  if (!p) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  try {
    return NextResponse.json({ proposal: await updateProposal(p, { ...body, note: typeof body.note === 'string' ? body.note : undefined }) });
  } catch (err) {
    if (err instanceof GuideInputError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}

// DELETE — withdraw.
export async function DELETE(_req: Request, ctx: Ctx) {
  const p = await own(ctx);
  if (!p) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  try {
    await withdrawProposal(p);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof GuideInputError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
