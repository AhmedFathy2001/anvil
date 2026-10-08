import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { exchangeCodeForTokenSet, fetchDiscordUser } from '@/lib/discord-oauth';
import { storeJoinGrant } from '@/lib/discordUserTokens';
import { joinPendingEventServersNow } from '@/lib/eventDiscord';
import { scopeAllowsJoin } from '@/lib/eventDiscordPlan';
import { log } from '@/lib/logger';
import { safeReturnPath } from '@/lib/safe-redirect';
import { completeDiscordLogin, loginFailPage } from '@/lib/discord-login';
import { apexDomain, resolveReturnHost } from '@/lib/clanContext';

const STATE_COOKIE = 'discord_oauth_state';
const RETURN_COOKIE = 'discord_oauth_return';
const RETURN_HOST_COOKIE = 'discord_oauth_return_host';

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

  if (error) return loginFailPage(`Discord returned: ${error}`);
  if (!code || !state) return loginFailPage('Missing code or state.');

  const cookieMap = parseCookies(request);
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
      clearCookies: [STATE_COOKIE, RETURN_COOKIE, RETURN_HOST_COOKIE],
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
      }
    }
    return res;
  } catch (e) {
    return loginFailPage(e instanceof Error ? e.message : 'Could not complete login.', 500);
  }
}
