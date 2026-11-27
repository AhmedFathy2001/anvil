import { NextResponse } from 'next/server';

import { verifyUser } from '@/lib/auth';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';
import { deleteSetupOfUser, setupOfUser, shareTokenOfUser, stopShareOfUser, updateSetupOfUser } from '@/lib/tripSetups';

/**
 * The My setups page's actions on one saved trip setup (lib/tripSetups). Signed-in session; only a
 * setup on one of the person's own characters (setupOfUser checks it on every call):
 *   PATCH  {name?, tag?, isDefault?: true, shareClan?: boolean}   rename, tag, make default, clan share
 *   POST   {share: 'link' | 'stop'}                              make (or read) the share link, or stop it
 *   DELETE                                                       delete it
 */

export const dynamic = 'force-dynamic';

const notYours = () => NextResponse.json({ error: 'Not one of your setups.' }, { status: 404 });

async function gate(request: Request, params: Promise<{ id: string }>): Promise<{ userId: number; id: number } | NextResponse> {
  const session = await verifyUser();
  if (!session?.userId) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return notYours();
  const rl = await rateLimit(request, `profile-setups:${session.userId}`, { limit: 60, windowMs: 60_000 });
  if (!rl.ok) return NextResponse.json({ error: 'Too many changes, give it a minute.' }, { status: 429, headers: rateLimitHeaders(rl) });
  if (!(await setupOfUser(session.userId, id))) return notYours();
  return { userId: session.userId, id };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await gate(request, params);
  if (g instanceof NextResponse) return g;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  const refused = await updateSetupOfUser(g.userId, g.id, { name: body.name, tag: body.tag, isDefault: body.isDefault === true ? true : undefined, shareClan: body.shareClan });
  if (refused) return NextResponse.json({ error: refused }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await gate(request, params);
  if (g instanceof NextResponse) return g;
  const body = (await request.json().catch(() => null)) as { share?: unknown } | null;
  if (body?.share === 'stop') return NextResponse.json({ ok: await stopShareOfUser(g.userId, g.id) });
  if (body?.share !== 'link') return NextResponse.json({ error: 'Nothing to do' }, { status: 400 });
  const token = await shareTokenOfUser(g.userId, g.id);
  return token ? NextResponse.json({ token, path: `/setup/${token}` }) : notYours();
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await gate(request, params);
  if (g instanceof NextResponse) return g;
  return NextResponse.json({ ok: await deleteSetupOfUser(g.userId, g.id) });
}
