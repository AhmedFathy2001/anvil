import { NextResponse } from 'next/server';

import { verifyUser } from '@/lib/auth';
import { isPlatform } from '@/lib/connectedAccountsRules';
import { setMedalProfile, setShowOnProfile, unlinkConnectedAccount } from '@/lib/connectedAccounts';
import { rateLimitByKey, rateLimitHeaders } from '@/lib/rate-limit';

// /api/profile/connected-accounts/<twitch|youtube|kick|medal> — the signed-in person's own links
// (settings > Connected accounts, lib/connectedAccounts). Linking Twitch/YouTube is an OAuth round trip
// (/api/auth/twitch/start, /api/auth/youtube/start?as=link) and Kick a chat code (./kick-code); this
// route only changes what is already linked.
//
//   PATCH  { show: boolean }                    show / hide it on their profile
//   DELETE                                       unlink (and drop what was cached about it)
//   POST   (medal) { action: 'set', profile }    save their Medal profile link (a plain link, never verified)

const noStore = { 'Cache-Control': 'no-store' };

async function who(params: Promise<{ platform: string }>) {
  const session = await verifyUser();
  if (!session) return { error: NextResponse.json({ error: 'Sign in first' }, { status: 401 }) } as const;
  const { platform } = await params;
  if (!isPlatform(platform)) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) } as const;
  return { userId: session.userId, platform } as const;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ platform: string }> }) {
  const w = await who(params);
  if ('error' in w) return w.error;
  const body = (await request.json().catch(() => null)) as { show?: unknown } | null;
  if (typeof body?.show !== 'boolean') return NextResponse.json({ error: 'show must be true or false' }, { status: 400 });
  const ok = await setShowOnProfile(w.userId, w.platform, body.show);
  if (!ok) return NextResponse.json({ error: 'Nothing is linked there.' }, { status: 404 });
  return NextResponse.json({ ok: true }, { headers: noStore });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ platform: string }> }) {
  const w = await who(params);
  if ('error' in w) return w.error;
  await unlinkConnectedAccount(w.userId, w.platform);
  return NextResponse.json({ ok: true }, { headers: noStore });
}

const MEDAL_SET_ERRORS = {
  invalid: 'That doesn’t look like a Medal profile. Paste the link to it (medal.tv/u/name or medal.tv/users/123).',
} as const;

export async function POST(request: Request, { params }: { params: Promise<{ platform: string }> }) {
  const w = await who(params);
  if ('error' in w) return w.error;
  if (w.platform !== 'medal') return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const rl = await rateLimitByKey('medal-link', String(w.userId), { limit: 20, windowMs: 60 * 60_000 });
  if (!rl.ok) return NextResponse.json({ error: 'Too many tries — wait a bit.' }, { status: 429, headers: rateLimitHeaders(rl) });
  const body = (await request.json().catch(() => null)) as { action?: unknown; profile?: unknown } | null;
  if (body?.action === 'set') {
    const r = await setMedalProfile(w.userId, body.profile);
    return r.ok
      ? NextResponse.json({ ok: true }, { headers: noStore })
      : NextResponse.json({ error: MEDAL_SET_ERRORS[r.reason] }, { status: 400 });
  }
  return NextResponse.json({ error: 'Bad request' }, { status: 400 });
}
