import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

import { verifyUser } from '@/lib/auth';
import { apexDomain, originForHost, sessionCookieDomain } from '@/lib/apexHost';
import { resolveReturnHost } from '@/lib/clanContext';
import { isAdminOfCreatorSpace, linkViewerTwitch, saveHostTwitchChannel } from '@/lib/entryGatesDb';
import { log } from '@/lib/logger';
import { safeReturnPath } from '@/lib/safe-redirect';
import {
  TWITCH_NONCE_COOKIE,
  exchangeCode,
  fetchUser,
  hasHostScopes,
  revokeToken,
  twitchConfig,
  verifyState,
  type TwitchState,
} from '@/lib/twitch';

/** Outcomes, as `?twitch=` on the page they return to. Fixed words only — never echoed input. */
type Outcome = 'linked' | 'connected' | 'taken' | 'denied' | 'scopes' | 'error';

// GET /api/auth/twitch/callback?code=…&state=…  (TWITCH_REDIRECT_URI)
//
// Nothing here redirects anywhere until the state has been verified: signature, expiry, the nonce
// cookie from /start, and the SAME logged-in user. A forged or replayed state gets a plain 400, so
// the callback can never be used to bounce somebody to a page of an attacker's choosing — and even
// a verified return is a site-relative path on the apex or a clan host the database knows.
export async function GET(request: Request) {
  const cfg = twitchConfig();
  if (!cfg) return NextResponse.json({ error: 'Twitch is not set up on this server.' }, { status: 503 });

  const url = new URL(request.url);
  const jar = await cookies();
  const state = verifyState(url.searchParams.get('state'), cfg.tokenKey);
  const nonce = jar.get(TWITCH_NONCE_COOKIE)?.value;
  const session = await verifyUser();
  if (!state || !nonce || nonce !== state.n || !session || session.userId !== state.u) {
    return NextResponse.json({ error: 'That Twitch link expired or was not started here. Try again from Anvil.' }, { status: 400 });
  }

  const outcome = await finish(url, state, cfg, session.userId);
  const host = (state.h ? await resolveReturnHost(state.h) : null) ?? apexDomain();
  const back = new URL(safeReturnPath(state.r), originForHost(host));
  back.searchParams.set('twitch', outcome);
  const res = NextResponse.redirect(back);
  // One use only.
  res.cookies.set(TWITCH_NONCE_COOKIE, '', {
    path: '/api/auth/twitch',
    maxAge: 0,
    ...(sessionCookieDomain() ? { domain: sessionCookieDomain()! } : {}),
  });
  return res;
}

async function finish(url: URL, state: TwitchState, cfg: NonNullable<ReturnType<typeof twitchConfig>>, userId: number): Promise<Outcome> {
  if (url.searchParams.get('error')) return 'denied';
  const code = url.searchParams.get('code');
  if (!code || code.length > 512) return 'error';

  try {
    const tokens = await exchangeCode(cfg, code);
    const user = await fetchUser(cfg, tokens.accessToken);

    if (state.m === 'viewer') {
      // Identity only: the token has told us who they are and is not kept.
      void revokeToken(cfg, tokens.accessToken);
      return (await linkViewerTwitch(userId, user)) === 'taken' ? 'taken' : 'linked';
    }

    // Host: re-check authority now, not just at /start.
    if (state.c == null || !(await isAdminOfCreatorSpace(state.c, userId))) {
      void revokeToken(cfg, tokens.accessToken);
      return 'error';
    }
    if (!hasHostScopes(tokens.scope) || !tokens.refreshToken) {
      void revokeToken(cfg, tokens.accessToken);
      return 'scopes';
    }
    await saveHostTwitchChannel({
      clanId: state.c,
      userId,
      cfg,
      tokens: { ...tokens, refreshToken: tokens.refreshToken },
      user,
    });
    return 'connected';
  } catch (err) {
    log.warn('twitch.callback-fail', { mode: state.m }, err);
    return 'error';
  }
}
