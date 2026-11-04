import { NextResponse } from 'next/server';

import { verifyUser } from '@/lib/auth';
import { unlinkViewerTwitch, viewerTwitch } from '@/lib/entryGatesDb';
import { twitchConfigured } from '@/lib/twitch';

/** The signed-in person's linked Twitch account (login only — no tokens are kept for viewers). */
export async function GET() {
  const session = await verifyUser();
  if (!session) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  const linked = await viewerTwitch(session.userId);
  return NextResponse.json({ configured: twitchConfigured(), login: linked?.login ?? null });
}

/** Unlink it. Gated events they already joined keep them; new joins ask again. */
export async function DELETE() {
  const session = await verifyUser();
  if (!session) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  await unlinkViewerTwitch(session.userId);
  return NextResponse.json({ ok: true });
}
