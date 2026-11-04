import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

import { verifyUser } from '@/lib/auth';
import { apexDomain, originForHost, sessionCookieDomain } from '@/lib/apexHost';
import { resolveReturnHost } from '@/lib/clanContext';
import { gateCache, gatesForEvent, isAdminOfCreatorSpace } from '@/lib/entryGatesDb';
import { connectConflict } from '@/lib/streamChannels';
import { hostYoutubeChannel, proveSubscription, saveHostYoutubeChannel } from '@/lib/gates/youtubeDb';
import { log } from '@/lib/logger';
import { safeReturnPath } from '@/lib/safe-redirect';
import {
  YOUTUBE_NONCE_COOKIE,
  exchangeCode,
  fetchMyChannel,
  hasYoutubeScope,
  revokeToken,
  verifyState,
  youtubeConfig,
  type YoutubeConfig,
  type YoutubeState,
} from '@/lib/gates/youtube';

/** Outcomes, as `?youtube=` on the page they return to. Fixed words only — never echoed input. */
// `elsewhere` / `in-use`: the host's channel is connected to another place (lib/streamChannels).
type Outcome = 'subscribed' | 'notsub' | 'linked' | 'taken' | 'private' | 'nochannel' | 'connected' | 'denied' | 'scopes' | 'error' | 'elsewhere' | 'in-use';

// GET /api/auth/youtube/callback?code=…&state=…  (YOUTUBE_REDIRECT_URI)
//
// As the Twitch callback: nothing redirects anywhere until the state has been verified (signature,
// expiry, the nonce cookie from /start, the SAME logged-in user). A forged or replayed state gets a
// plain 400; a verified return is a site-relative path on the apex or a clan host the database knows.
export async function GET(request: Request) {
  const cfg = youtubeConfig();
  if (!cfg) return NextResponse.json({ error: 'YouTube is not set up on this server.' }, { status: 503 });

  const url = new URL(request.url);
  const jar = await cookies();
  const state = verifyState(url.searchParams.get('state'), cfg.tokenKey);
  const nonce = jar.get(YOUTUBE_NONCE_COOKIE)?.value;
  const session = await verifyUser();
  if (!state || !nonce || nonce !== state.n || !session || session.userId !== state.u) {
    return NextResponse.json({ error: 'That YouTube link expired or was not started here. Try again from Anvil.' }, { status: 400 });
  }

  const moveFrom: { id: number | null } = { id: null };
  const outcome = await finish(url, state, cfg, session.userId, moveFrom);
  const host = (state.h ? await resolveReturnHost(state.h) : null) ?? apexDomain();
  const back = new URL(safeReturnPath(state.r), originForHost(host));
  back.searchParams.set('youtube', outcome);
  if (outcome === 'elsewhere' && moveFrom.id != null) back.searchParams.set('move', String(moveFrom.id));
  const res = NextResponse.redirect(back);
  res.cookies.set(YOUTUBE_NONCE_COOKIE, '', {
    path: '/api/auth/youtube',
    maxAge: 0,
    ...(sessionCookieDomain() ? { domain: sessionCookieDomain()! } : {}),
  });
  return res;
}

async function finish(url: URL, state: YoutubeState, cfg: YoutubeConfig, userId: number, moveFrom: { id: number | null }): Promise<Outcome> {
  if (url.searchParams.get('error')) return 'denied';
  const code = url.searchParams.get('code');
  if (!code || code.length > 1024) return 'error';

  let accessToken: string | null = null;
  try {
    const tokens = await exchangeCode(cfg, code);
    accessToken = tokens.accessToken;
    if (!hasYoutubeScope(tokens.scope)) return 'scopes';

    if (state.m === 'viewer') {
      // The event must still be a YouTube-gated creator event with a connected host channel. Every
      // viewer sign-in links their channel (identity only); a subscriber rule also checks the sub.
      const g = await gatesForEvent(state.c);
      if (!g || !g.gates.anyOf.some((r) => r.kind === 'youtube-sub' || r.kind === 'youtube-member')) return 'error';
      const hostCh = await hostYoutubeChannel(g.clanId);
      if (!hostCh) return 'error';
      const r = await proveSubscription({
        userId,
        hostChannelId: hostCh.channelId,
        token: tokens.accessToken,
        checkSub: g.gates.anyOf.some((x) => x.kind === 'youtube-sub'),
      });
      gateCache.forgetUser(userId);
      return r;
    }

    // Host: re-check authority now, not just at /start.
    if (!(await isAdminOfCreatorSpace(state.c, userId))) return 'error';
    if (!tokens.refreshToken) return 'scopes';
    const me = await fetchMyChannel(tokens.accessToken);
    if (!me.ok) return 'error';
    if (!me.value) return 'nochannel';
    // One channel, one place (lib/streamChannels): connected elsewhere → ask, never copy.
    const conflict = await connectConflict('youtube', me.value.id, state.c, userId);
    if (conflict) {
      if (conflict.outcome === 'taken') return 'in-use';
      moveFrom.id = conflict.fromClanId;
      return 'elsewhere';
    }
    await saveHostYoutubeChannel({
      clanId: state.c,
      userId,
      cfg,
      tokens: { ...tokens, refreshToken: tokens.refreshToken },
      channel: me.value,
    });
    accessToken = null; // kept (encrypted) — do not revoke
    return 'connected';
  } catch (err) {
    log.warn('youtube.callback-fail', { mode: state.m }, err);
    return 'error';
  } finally {
    // A viewer's token has done its job; a host token we did not keep is not left authorised either.
    if (accessToken) void revokeToken(accessToken);
  }
}
