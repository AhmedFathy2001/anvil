import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { buildAuthorizeUrl, getOAuthMode, isSharedLoginAvailable } from '@/lib/discord-oauth';
import { safeReturnPath } from '@/lib/safe-redirect';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';
import { getBrokerBaseUrl } from '@/lib/pluginConfig';
import { getInstanceId } from '@/lib/federation';
import { publicOrigin } from '@/lib/request-origin';

const STATE_COOKIE = 'discord_oauth_state';
const RETURN_COOKIE = 'discord_oauth_return';
const BROKER_STATE_COOKIE = 'discord_broker_state';
const BROKER_RETURN_COOKIE = 'discord_broker_return';
const STATE_TTL_SECONDS = 600; // 10 minutes

// GET /api/auth/discord/start?return=/profile[&mode=broker]
// Kicks off login. On an "own app" instance it redirects straight to Discord (unchanged). On a
// managed instance it hands off to the shared Anvil broker, which authenticates the Discord identity
// and returns a signed assertion to our broker-callback. `?mode=broker` forces the broker path — the
// recovery hatch so a misconfigured BYO app can never permanently lock a managed admin out.
export async function GET(request: Request) {
  const rl = await rateLimit(request, 'oauth-start', { limit: 30, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many login attempts — try again shortly.' },
      { status: 429, headers: rateLimitHeaders(rl) },
    );
  }

  const url = new URL(request.url);
  const returnTo = safeReturnPath(url.searchParams.get('return'));
  const isProd = process.env.NODE_ENV === 'production';

  const forceBroker = url.searchParams.get('mode') === 'broker';
  const mode = getOAuthMode();
  const useBroker = (mode === 'brokered' || forceBroker) && isSharedLoginAvailable();

  if (useBroker) return startBrokeredLogin(request, returnTo, isProd);
  if (mode === 'own') return startOwnLogin(returnTo, isProd);

  return NextResponse.json({ error: 'Discord login is not configured on the server.' }, { status: 503 });
}

// Direct Discord OAuth (self-host / BYO app).
function startOwnLogin(returnTo: string, isProd: boolean): NextResponse {
  const state = crypto.randomBytes(24).toString('hex');
  const res = NextResponse.redirect(buildAuthorizeUrl(state));
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    path: '/',
    maxAge: STATE_TTL_SECONDS,
  });
  if (returnTo !== '/') {
    res.cookies.set(RETURN_COOKIE, returnTo, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd,
      path: '/',
      maxAge: STATE_TTL_SECONDS,
    });
  }
  return res;
}

// Brokered login (managed): redirect to the broker's login-start with our instance id + the absolute
// URL of OUR broker-callback (which the broker allowlists against our registered baseUrl) + a CSRF
// state we round-trip. The final where-to-go-after-login path stays in a cookie on our side.
async function startBrokeredLogin(request: Request, returnTo: string, isProd: boolean): Promise<NextResponse> {
  const brokerBase = await getBrokerBaseUrl();
  if (!brokerBase) {
    return NextResponse.json({ error: 'Brokered login is not configured.' }, { status: 503 });
  }
  const instanceId = await getInstanceId();
  const origin = publicOrigin(request);
  const state = crypto.randomBytes(24).toString('hex');

  const params = new URLSearchParams({
    instance_id: instanceId,
    return: `${origin}/api/auth/discord/broker-callback`,
    state,
  });
  const res = NextResponse.redirect(`${brokerBase}/api/federation/auth/login/start?${params.toString()}`);
  res.cookies.set(BROKER_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    path: '/',
    maxAge: STATE_TTL_SECONDS,
  });
  if (returnTo !== '/') {
    res.cookies.set(BROKER_RETURN_COOKIE, returnTo, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd,
      path: '/',
      maxAge: STATE_TTL_SECONDS,
    });
  }
  return res;
}
