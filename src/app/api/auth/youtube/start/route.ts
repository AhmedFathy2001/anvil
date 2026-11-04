import { NextResponse } from 'next/server';

import { verifyUser } from '@/lib/auth';
import { apexDomain, isApexHost, originForHost, sessionCookieDomain } from '@/lib/apexHost';
import { resolveClanFromRequest } from '@/lib/clanContext';
import { isAdminOfCreatorSpace } from '@/lib/entryGatesDb';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';
import { safeReturnPath } from '@/lib/safe-redirect';
import {
  STATE_TTL_MS,
  YOUTUBE_NONCE_COOKIE,
  authorizeUrl,
  newNonce,
  signState,
  youtubeConfig,
  type YoutubeLinkMode,
} from '@/lib/gates/youtube';

// GET /api/auth/youtube/start?as=viewer&event=<eventId>&return=/c/slug/events/12
// GET /api/auth/youtube/start?as=host&space=<clanId>&return=/admin/clan
//
// Starts a Google sign-in for YouTube (lib/gates/youtube), scope youtube.readonly either way:
//   viewer — "check my subscription to this event's host". The token is used for two reads and revoked.
//   host   — a creator space's admin connecting the space's channel (its token reads live chat).
//
// The same shape as /api/auth/twitch/start: runs on the APEX (YOUTUBE_REDIRECT_URI is one URL), the
// state is signed, names the user, is bound to a nonce cookie, and the return path is sanitized here
// and again at the callback.
export async function GET(request: Request) {
  const rl = await rateLimit(request, 'youtube-start', { limit: 20, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json({ error: 'Too many attempts — try again shortly.' }, { status: 429, headers: rateLimitHeaders(rl) });
  }
  const cfg = youtubeConfig();
  if (!cfg) return NextResponse.json({ error: 'YouTube is not set up on this server.' }, { status: 503 });

  const url = new URL(request.url);
  const as = url.searchParams.get('as');
  // 'link' = settings' Connected accounts: who you are on YouTube, no event involved.
  const mode: YoutubeLinkMode = as === 'host' ? 'host' : as === 'link' ? 'link' : 'viewer';
  const returnTo = safeReturnPath(url.searchParams.get('return'));
  const target = Number(url.searchParams.get(mode === 'host' ? 'space' : 'event'));
  const host = request.headers.get('host');

  if (!isApexHost(host)) {
    const clan = await resolveClanFromRequest(request);
    const apexStart = new URL('/api/auth/youtube/start', originForHost(apexDomain()));
    apexStart.searchParams.set('as', mode);
    apexStart.searchParams.set('return', returnTo);
    if (Number.isInteger(target) && target > 0) apexStart.searchParams.set(mode === 'host' ? 'space' : 'event', String(target));
    if (clan) apexStart.searchParams.set('clan', clan.host);
    return NextResponse.redirect(apexStart);
  }

  const session = await verifyUser();
  if (!session) return NextResponse.redirect(new URL(`/login?return=${encodeURIComponent(returnTo)}`, request.url));

  if (mode !== 'link' && (!Number.isInteger(target) || target <= 0)) return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  if (mode === 'host' && !(await isAdminOfCreatorSpace(target, session.userId))) {
    return NextResponse.json({ error: 'Only the space’s admins can connect its YouTube channel.' }, { status: 403 });
  }
  // Viewer: the event (and that it is YouTube-gated) is checked at the callback, where it matters.

  const nonce = newNonce();
  const state = signState(
    {
      u: session.userId,
      m: mode,
      c: mode === 'link' ? 0 : target,
      r: returnTo,
      h: url.searchParams.get('clan')?.slice(0, 253) || null,
      n: nonce,
      e: Date.now() + STATE_TTL_MS,
    },
    cfg.tokenKey,
  );

  const res = NextResponse.redirect(authorizeUrl(cfg, mode, state));
  res.cookies.set(YOUTUBE_NONCE_COOKIE, nonce, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/api/auth/youtube',
    maxAge: Math.floor(STATE_TTL_MS / 1000),
    ...(sessionCookieDomain() ? { domain: sessionCookieDomain()! } : {}),
  });
  return res;
}
