import { decodeProtectedHeader, decodeJwt, errors as joseErrors } from 'jose';
import { verifyBrokerAssertion, createGuardedRemoteJWKSet } from '@/lib/federationJwks';
import { getInstanceId, recordFederationJti } from '@/lib/federation';
import { getBrokerBaseUrl } from '@/lib/pluginConfig';
import { isSharedLoginAvailable } from '@/lib/discord-oauth';
import type { DiscordUser } from '@/lib/discord-oauth';
import { completeDiscordLogin, loginFailPage } from '@/lib/discord-login';
import { safeReturnPath } from '@/lib/safe-redirect';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';
import { NextResponse } from 'next/server';

const BROKER_STATE_COOKIE = 'discord_broker_state';
const BROKER_RETURN_COOKIE = 'discord_broker_return';

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

const norm = (u: string): string => u.replace(/\/+$/, '');

// GET /api/auth/discord/broker-callback?assertion=<jwt>&state=…
// The landing spot for brokered (managed) login. The shared Anvil broker has authenticated the user's
// Discord identity and redirected here with a short-lived EdDSA assertion. We verify it exactly like
// the federation /exchange path — alg pinned, issuer = OUR configured broker, audience = OUR instance
// id, single-use jti — then hand the identity to the SAME completeDiscordLogin pipeline the direct
// callback uses. All authorization (bans, roles, ownership) is decided there, on the site.
export async function GET(request: Request) {
  const rl = await rateLimit(request, 'oauth-broker-callback', { limit: 30, windowMs: 60_000 });
  if (!rl.ok) {
    return new NextResponse('Too many attempts — try again shortly.', {
      status: 429,
      headers: rateLimitHeaders(rl),
    });
  }

  if (!isSharedLoginAvailable()) return loginFailPage('Brokered login is not enabled here.', 400);

  const url = new URL(request.url);
  const assertion = url.searchParams.get('assertion');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  if (error) return loginFailPage(`Login provider returned: ${error}`);
  if (!assertion || !state) return loginFailPage('Missing login token or state.');

  const cookieMap = parseCookies(request);
  const expectedState = cookieMap.get(BROKER_STATE_COOKIE);
  const returnTo = safeReturnPath(cookieMap.get(BROKER_RETURN_COOKIE));
  if (!expectedState || expectedState !== state) {
    return loginFailPage('Login state mismatch — please retry from the login page.');
  }

  const brokerBase = norm((await getBrokerBaseUrl()) || '');
  if (!brokerBase) return loginFailPage('Brokered login is not configured.', 503);

  // Pin alg === EdDSA up front (blocks alg-confusion / alg:none before key resolution).
  let alg: string | undefined;
  try {
    ({ alg } = decodeProtectedHeader(assertion));
  } catch {
    return loginFailPage('Malformed login token.', 422);
  }
  if (alg !== 'EdDSA') return loginFailPage('Login token alg must be EdDSA.', 422);

  // Decode (UNVERIFIED) only to read iss for key selection; jwtVerify re-binds it below. A login
  // assertion must come from exactly OUR configured broker — no admin-editable trust list here.
  let unverified: ReturnType<typeof decodeJwt>;
  try {
    unverified = decodeJwt(assertion);
  } catch {
    return loginFailPage('Malformed login token.', 422);
  }
  const iss = typeof unverified.iss === 'string' ? norm(unverified.iss) : '';
  if (iss !== brokerBase) return loginFailPage('Login token issuer is not this site’s broker.', 403);

  const instanceId = await getInstanceId();
  const jwksUrl = `${brokerBase}/api/federation/v1/jwks.json`;

  let payload;
  try {
    ({ payload } = await verifyBrokerAssertion(assertion, createGuardedRemoteJWKSet(jwksUrl), {
      issuer: iss,
      audience: instanceId,
    }));
  } catch (err) {
    if (err instanceof joseErrors.JWTClaimValidationFailed && err.claim === 'aud') {
      return loginFailPage('Login token was not issued for this site.', 403);
    }
    return loginFailPage('Login token failed validation.', 422);
  }

  const sub = typeof payload.sub === 'string' ? payload.sub.trim() : '';
  const jti = typeof payload.jti === 'string' ? payload.jti.trim() : '';
  if (!sub || !jti) return loginFailPage('Login token missing sub or jti.', 422);

  // Single-use: a replayed login link is refused. Cap the row lifetime at now+120s regardless of a
  // (compromised-broker) far-future exp — maxTokenAge already bounds usefulness to ≤90s from iat.
  const rawExpMs = typeof payload.exp === 'number' ? payload.exp * 1000 : Date.now() + 90_000;
  const fresh = await recordFederationJti(jti, new Date(Math.min(rawExpMs, Date.now() + 120_000)));
  if (!fresh) return loginFailPage('This login link was already used — please sign in again.', 409);

  // Build the identity from the assertion's claims. Brokered login carries no email scope, so email
  // stays null (completeDiscordLogin won't clobber a previously-captured email with null).
  const discordUser: DiscordUser = {
    id: sub,
    username: typeof payload.username === 'string' ? payload.username : sub,
    globalName: typeof payload.global_name === 'string' ? payload.global_name : null,
    avatar: typeof payload.avatar === 'string' ? payload.avatar : null,
    email: null,
  };

  try {
    return await completeDiscordLogin(discordUser, {
      returnTo,
      request,
      clearCookies: [BROKER_STATE_COOKIE, BROKER_RETURN_COOKIE],
    });
  } catch (e) {
    return loginFailPage(e instanceof Error ? e.message : 'Could not complete login.', 500);
  }
}
