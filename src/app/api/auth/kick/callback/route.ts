import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

import { db } from '@/db';
import { clanAuditLog } from '@/db/schema';
import { verifyUser } from '@/lib/auth';
import { apexDomain, originForHost, sessionCookieDomain } from '@/lib/apexHost';
import { resolveReturnHost } from '@/lib/clanContext';
import { isAdminOfCreatorSpace } from '@/lib/entryGatesDb';
import { finishHostKickConnect, kickFetch } from '@/lib/gates/kickDb';
import { log } from '@/lib/logger';
import { safeReturnPath } from '@/lib/safe-redirect';
import {
  KICK_NONCE_COOKIE,
  exchangeKickCode,
  kickConfig,
  pkceVerifier,
  revokeKickToken,
  verifyKickState,
  type KickConfig,
  type KickState,
} from '@/lib/kick';

/** Outcomes, as `?kick=` on the page they return to. Fixed words only — never echoed input. */
type Outcome = 'connected' | 'denied' | 'scopes' | 'error' | 'webhooks';

// GET /api/auth/kick/callback?code=…&state=…  (KICK_REDIRECT_URI)
//
// Nothing redirects anywhere until the state is verified: signature, expiry, the nonce cookie from
// /start, and the SAME logged-in user. A forged or replayed state gets a plain 400.
export async function GET(request: Request) {
  const cfg = kickConfig();
  if (!cfg) return NextResponse.json({ error: 'Kick is not set up on this server.' }, { status: 503 });

  const url = new URL(request.url);
  const jar = await cookies();
  const state = verifyKickState(url.searchParams.get('state'), cfg.tokenKey);
  const nonce = jar.get(KICK_NONCE_COOKIE)?.value;
  const session = await verifyUser();
  if (!state || !nonce || nonce !== state.n || !session || session.userId !== state.u) {
    return NextResponse.json({ error: 'That Kick link expired or was not started here. Try again from Anvil.' }, { status: 400 });
  }

  const outcome = await finish(url, state, cfg, session.userId);
  const host = (state.h ? await resolveReturnHost(state.h) : null) ?? apexDomain();
  const back = new URL(safeReturnPath(state.r), originForHost(host));
  back.searchParams.set('kick', outcome);
  const res = NextResponse.redirect(back);
  res.cookies.set(KICK_NONCE_COOKIE, '', {
    path: '/api/auth/kick',
    maxAge: 0,
    ...(sessionCookieDomain() ? { domain: sessionCookieDomain()! } : {}),
  });
  return res;
}

async function finish(url: URL, state: KickState, cfg: KickConfig, userId: number): Promise<Outcome> {
  if (url.searchParams.get('error')) return 'denied';
  const code = url.searchParams.get('code');
  if (!code || code.length > 1024) return 'error';
  try {
    const tokens = await exchangeKickCode(cfg, code, pkceVerifier(state.n, cfg.tokenKey), kickFetch());
    // Re-check authority now, not just at /start.
    if (!(await isAdminOfCreatorSpace(state.c, userId))) {
      void revokeKickToken(tokens.accessToken, kickFetch());
      return 'error';
    }
    const r = await finishHostKickConnect({ clanId: state.c, userId, cfg, tokens });
    if (r === 'scopes') {
      void revokeKickToken(tokens.accessToken, kickFetch());
      return 'scopes';
    }
    await db
      .insert(clanAuditLog)
      .values({ clanId: state.c, eventType: 'creator_kick_connected', actorUserId: userId })
      .catch(() => {});
    return r === 'connected' ? 'connected' : 'webhooks';
  } catch (err) {
    log.warn('kick.callback-fail', {}, err);
    return 'error';
  }
}
