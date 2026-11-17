import { NextResponse } from 'next/server';
import { revokePluginToken } from '@/lib/auth';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

// POST /api/plugin/auth/signout — ends the sign-in the Bearer token belongs to, on the server.
//
// The plugin's Sign out used to forget the token on the player's own computer and nothing else, so a
// token copied before then kept working until "Revoke all" on the site. Calling this first makes
// Sign out mean what it says. Only the token presented is revoked, so a second computer stays signed
// in. Idempotent: an unknown or already-revoked token answers the same way, since the caller's goal
// (this token no longer works) is already true.
export async function POST(request: Request) {
  const rl = await rateLimit(request, 'plugin-auth-signout', { limit: 20, windowMs: 5 * 60 * 1000 });
  if (!rl.ok) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: rateLimitHeaders(rl) });
  }
  const header = request.headers.get('Authorization');
  if (!header?.startsWith('Bearer ') || !header.slice(7).trim()) {
    return NextResponse.json({ error: 'Provide Authorization: Bearer <pluginToken>' }, { status: 401 });
  }
  const revoked = await revokePluginToken(header.slice(7));
  return NextResponse.json({ ok: true, revoked }, { headers: rateLimitHeaders(rl) });
}
