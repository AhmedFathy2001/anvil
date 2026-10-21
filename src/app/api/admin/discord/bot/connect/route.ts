import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { headers } from 'next/headers';
import { verifyUser } from '@/lib/auth';
import { atLeast } from '@/lib/clanRoles';
import { apexDomain, isApexHost, originForHost, requireClan, sessionCookieDomain } from '@/lib/clanContext';
import { buildBotConnectUrl } from '@/lib/discord-oauth';
import { BOT_CONNECT_COOKIE, BOT_INVITE_PERMISSIONS, oauthConnectAvailable } from '@/lib/discordGuildBinding';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';

// Shared with api/auth/discord/start + callback: the callback verifies this state either way.
const STATE_COOKIE = 'discord_oauth_state';
const STATE_TTL_SECONDS = 600;

// GET /c/<slug>/api/admin/discord/bot/connect — a navigation, from the Connection section's
// "Connect your Discord server" button. Sends the admin to Discord's add-the-bot screen; the server
// they pick comes back to api/auth/discord/callback and is bound to this clan.
export async function GET(request: Request) {
  const rl = await rateLimit(request, 'oauth-start', { limit: 30, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json({ error: 'Too many attempts — try again shortly.' }, { status: 429, headers: rateLimitHeaders(rl) });
  }

  const clan = await requireClan();
  const actor = await verifyUser();
  if (!actor || !atLeast(actor.role, 'admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // The callback is on the apex, and so are the cookies it reads. A clan reached on its own host
  // starts again from the apex path so the state cookie lands where the callback can see it.
  // `?then=setup` sends the admin back to the setup wizard instead of the Discord page, so a first
  // run never leaves the wizard. A fixed word, never a path, so it can't become an open redirect.
  const then = new URL(request.url).searchParams.get('then') === 'setup' ? 'setup' : '';
  if (!isApexHost((await headers()).get('host'))) {
    return NextResponse.redirect(
      new URL(`/c/${clan.slug}/api/admin/discord/bot/connect${then ? `?then=${then}` : ''}`, originForHost(apexDomain())),
    );
  }

  if (!(await oauthConnectAvailable(clan.id))) {
    return NextResponse.json(
      { error: 'One-click connect needs the shared Anvil bot. Enter your server ID instead.' },
      { status: 400 },
    );
  }

  const state = crypto.randomBytes(24).toString('hex');
  const res = NextResponse.redirect(buildBotConnectUrl(state, BOT_INVITE_PERMISSIONS));
  const cookie = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: STATE_TTL_SECONDS,
    ...(sessionCookieDomain() ? { domain: sessionCookieDomain()! } : {}),
  };
  res.cookies.set(STATE_COOKIE, state, cookie);
  // Carries its own state, so only THIS round trip is treated as a connect: a login started while an
  // abandoned connect cookie is still alive has a different state and goes the ordinary way.
  res.cookies.set(BOT_CONNECT_COOKIE, `${clan.id}:${state}${then ? `:${then}` : ''}`, cookie);
  return res;
}
