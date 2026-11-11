import { NextResponse } from 'next/server';
import { clanPathOf } from '@/lib/clanScopedPaths';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { clans, users } from '@/db/schema';
import { exchangeCodeForTokenSet, fetchDiscordUser } from '@/lib/discord-oauth';
import { storeJoinGrant } from '@/lib/discordUserTokens';
import { joinPendingEventServersNow } from '@/lib/eventDiscord';
import { scopeAllowsJoin } from '@/lib/eventDiscordPlan';
import { log } from '@/lib/logger';
import { safeReturnPath } from '@/lib/safe-redirect';
import { track } from '@/lib/analytics';
import { completeDiscordLogin, loginFailPage } from '@/lib/discord-login';
import { apexDomain, originForHost, resolveReturnHost, sessionCookieDomain } from '@/lib/clanContext';
import { BOT_CONNECT_COOKIE } from '@/lib/discordGuildBinding';
import { joinAnvilDiscord, sendWelcomeDm, welcomeContextFor } from '@/lib/welcomeDm';
import { finishBotConnect } from '@/lib/discordBotConnect';

const STATE_COOKIE = 'discord_oauth_state';
const RETURN_COOKIE = 'discord_oauth_return';
const RETURN_HOST_COOKIE = 'discord_oauth_return_host';
const SID_COOKIE = 'discord_oauth_sid';
const ANVIL_JOIN_COOKIE = 'discord_oauth_anvil_join';

function parseCookies(request: Request): Map<string, string> {
  const cookieHeader = request.headers.get('cookie') || '';
  return new Map(
    cookieHeader
      .split(';')
      .map((c) => c.trim().split('='))
      .filter((p) => p.length === 2)
      .map(([k, v]) => [k, decodeURIComponent(v)]),
  );
}

// GET /api/auth/discord/callback?code=…&state=…
//
// Runs on the APEX — it is the single redirect URI the Discord app allowlists, so every clan's login
// lands here. Verify CSRF state, exchange the code, then hand the identity to completeDiscordLogin,
// which sets an apex-scoped session cookie every clan beneath it can read, and sends the person back
// to the clan they started from.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  const cookieMap = parseCookies(request);
  // "Connect your Discord server" (api/admin/discord/bot/connect) comes back through this same
  // redirect — it's the one Discord allows — but it is not a login: no session is made here.
  // The cookie is "<clanId>:<state>[:setup]" and only claims a return whose state is its own.
  const [botClan, botState, botThen] = (cookieMap.get(BOT_CONNECT_COOKIE) ?? '').split(':');
  if (botClan && botState && botState === state) {
    return handleBotConnect(request, cookieMap, botClan, { code, state, error }, botThen === 'setup');
  }

  // Said no on Discord's screen to "Join the Anvil Discord": they're already signed in, so that's not
  // a failed login. Back to where they were, the clan they just made.
  if (error && cookieMap.get(ANVIL_JOIN_COOKIE) === '1') {
    const back = NextResponse.redirect(new URL(safeReturnPath(cookieMap.get(RETURN_COOKIE)), originForHost(apexDomain())));
    const domain = sessionCookieDomain();
    for (const c of [STATE_COOKIE, RETURN_COOKIE, RETURN_HOST_COOKIE, SID_COOKIE, ANVIL_JOIN_COOKIE]) {
      back.cookies.set(c, '', { path: '/', maxAge: 0, ...(domain ? { domain } : {}) });
    }
    return back;
  }
  if (error) return loginFailPage(`Discord returned: ${error}`);
  if (!code || !state) return loginFailPage('Missing code or state.');

  const expectedState = cookieMap.get(STATE_COOKIE);
  // Defense in depth: re-sanitize even though /start already validated it, so a tampered cookie
  // can't produce an external redirect.
  const returnTo = safeReturnPath(cookieMap.get(RETURN_COOKIE));

  if (!expectedState || expectedState !== state) {
    return loginFailPage('OAuth state mismatch — please retry from the login page.');
  }

  let discordUser;
  let tokenSet;
  try {
    tokenSet = await exchangeCodeForTokenSet(code);
    discordUser = await fetchDiscordUser(tokenSet.accessToken);
  } catch (e) {
    return loginFailPage(e instanceof Error ? e.message : 'Discord exchange failed.', 502);
  }

  // Where they came from. Re-resolved against the clans table rather than trusted from the cookie:
  // the value only ever becomes a redirect if it names a real clan, and what gets used is that
  // clan's canonical host from its row. Anything else falls back to the apex.
  const returnHost = (await resolveReturnHost(cookieMap.get(RETURN_HOST_COOKIE))) ?? apexDomain();

  try {
    const res = await completeDiscordLogin(discordUser, {
      returnTo,
      returnHost,
      request,
      analyticsSid: cookieMap.get(SID_COOKIE) ?? null,
      clearCookies: [STATE_COOKIE, RETURN_COOKIE, RETURN_HOST_COOKIE, SID_COOKIE, ANVIL_JOIN_COOKIE],
    });
    // The event page's auto-join opt-in (start?join=1). Only kept when Discord actually granted
    // guilds.join; a plain login carries no such scope and stores nothing. Best-effort: failing to
    // store it just means the player gets the invite flow instead.
    if (scopeAllowsJoin(tokenSet.scope)) {
      const user = await db.query.users.findFirst({
        where: eq(users.discordId, discordUser.id),
        columns: { id: true, banned: true },
      });
      if (user && !user.banned) {
        await storeJoinGrant(user.id, tokenSet).catch((err) => {
          log.warn('oauth.store-join-grant-fail', { userId: user.id }, err);
        });
        // Add them now, with the token in hand, to every event server they're waiting on — this
        // works even where grants can't be stored (no DISCORD_TOKEN_KEY).
        await joinPendingEventServersNow(discordUser.id, tokenSet.accessToken).catch((err) => {
          log.warn('oauth.join-now-fail', { userId: user.id }, err);
        });
        // "Join the Anvil Discord" from clan creation: in they go, and now that the bot shares a
        // server with them, the welcome DM that couldn't reach them before can (lib/welcomeDm).
        if (cookieMap.get(ANVIL_JOIN_COOKIE) === '1') {
          const joined = await joinAnvilDiscord(user.id, tokenSet.accessToken);
          if (joined === 'joined' || joined === 'already') {
            const what = await welcomeContextFor(user.id).catch(() => null);
            if (what) await sendWelcomeDm(user.id, what);
          }
        }
      }
    }
    return res;
  } catch (e) {
    return loginFailPage(e instanceof Error ? e.message : 'Could not complete login.', 500);
  }
}

/**
 * The bot-connect return: verify state, redeem the code, bind the server (lib/discordBotConnect),
 * and send the admin back to their Discord settings with the outcome in the query string. Failures
 * land there too, as a code the page explains — not on the login error page, which isn't where
 * they were.
 */
async function handleBotConnect(
  request: Request,
  cookieMap: Map<string, string>,
  clanIdCookie: string,
  q: { code: string | null; state: string | null; error: string | null },
  toSetup = false,
) {
  const back = (clan: { slug: string; kind: string } | null, outcome: string) => {
    const path = clan ? clanPathOf(clan, `/admin/${toSetup ? 'setup' : 'integrations'}`) : '/';
    const res = NextResponse.redirect(new URL(`${path}?discord=${encodeURIComponent(outcome)}`, originForHost(apexDomain())));
    const gone = { path: '/', maxAge: 0, ...(sessionCookieDomain() ? { domain: sessionCookieDomain()! } : {}) };
    res.cookies.set(STATE_COOKIE, '', gone);
    res.cookies.set(BOT_CONNECT_COOKIE, '', gone);
    return res;
  };
  // Where to send them on an early failure: the clan named in the cookie, looked up, never echoed.
  const slugFor = async () => {
    const id = Number(clanIdCookie);
    if (!Number.isInteger(id) || id <= 0) return null;
    const row = await db.query.clans.findFirst({ where: eq(clans.id, id), columns: { slug: true, kind: true } });
    return row ?? null;
  };

  if (q.error) return back(await slugFor(), q.error === 'access_denied' ? 'cancelled' : 'discord-error');
  const expectedState = cookieMap.get(STATE_COOKIE);
  if (!q.code || !q.state || !expectedState || expectedState !== q.state) return back(await slugFor(), 'connect-expired');

  try {
    const tokenSet = await exchangeCodeForTokenSet(q.code);
    const discordUser = await fetchDiscordUser(tokenSet.accessToken);
    const result = await finishBotConnect({ clanIdCookie, tokenSet, discordUserId: discordUser.id });
    if (result.ok) track('discord.connected', { clanId: Number(clanIdCookie) });
    // Looked up again for its kind: the result only carries the slug, and a space is at /s/.
    return back(await slugFor(), result.ok ? 'connected' : result.error);
  } catch (e) {
    log.warn('oauth.bot-connect-fail', {}, e);
    return back(await slugFor(), 'discord-error');
  }
}
