import { NextResponse } from 'next/server';
import { mintDeviceCode } from '@/lib/pluginDeviceAuth';
import { publicOrigin } from '@/lib/request-origin';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

// POST /api/plugin/auth/start — begin the plugin's device-code sign-in (RFC 8628 shape, home-native).
// Unauthenticated by design (the whole point is the caller has no credential yet), so rate-limited
// tightly per IP. Returns the verification URL ON THIS SITE — the plugin refuses to open anything
// that isn't its configured home origin + /link-device.
export async function POST(request: Request) {
  const rl = await rateLimit(request, 'plugin-auth-start', { limit: 10, windowMs: 5 * 60 * 1000 });
  if (!rl.ok) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: rateLimitHeaders(rl) });
  }

  const minted = await mintDeviceCode();
  const origin = publicOrigin(request);
  const verificationUrl = `${origin}/link-device`;
  return NextResponse.json(
    {
      device_code: minted.deviceCode,
      user_code: minted.userCode,
      verification_url: verificationUrl,
      verification_url_complete: `${verificationUrl}?code=${encodeURIComponent(minted.userCode)}`,
      interval: minted.interval,
      expires_in: minted.expiresIn,
    },
    { headers: rateLimitHeaders(rl) },
  );
}
