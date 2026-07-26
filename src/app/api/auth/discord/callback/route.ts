import { exchangeCodeForToken, fetchDiscordUser } from '@/lib/discord-oauth';
import { safeReturnPath } from '@/lib/safe-redirect';
import { completeDiscordLogin, loginFailPage } from '@/lib/discord-login';

const STATE_COOKIE = 'discord_oauth_state';
const RETURN_COOKIE = 'discord_oauth_return';

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
// Direct-OAuth login (self-host / BYO app): verify CSRF state, exchange the code, fetch the Discord
// user, then hand the identity to the shared completeDiscordLogin pipeline (find-or-create + session).
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
  try {
    const accessToken = await exchangeCodeForToken(code);
    discordUser = await fetchDiscordUser(accessToken);
  } catch (e) {
    return loginFailPage(e instanceof Error ? e.message : 'Discord exchange failed.', 502);
  }

  try {
    return await completeDiscordLogin(discordUser, {
      returnTo,
      request,
      clearCookies: [STATE_COOKIE, RETURN_COOKIE],
    });
  } catch (e) {
    return loginFailPage(e instanceof Error ? e.message : 'Could not complete login.', 500);
  }
}
