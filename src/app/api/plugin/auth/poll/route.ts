import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { pluginDeviceCodes, users } from '@/db/schema';
import { hashDeviceCode } from '@/lib/pluginDeviceAuth';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

// POST /api/plugin/auth/poll — the plugin's poll step of the device-code sign-in. Body
// `{ device_code }`. Statuses mirror RFC 8628: slow_down | expired | denied | pending |
// complete{ token }. The account token is returned exactly ONCE (row flips to redeemed);
// a re-poll of a redeemed code reads as expired.
export async function POST(request: Request) {
  // Generous (it's a hot loop) but bounded; per-device pacing below is the primary control.
  const rl = await rateLimit(request, 'plugin-auth-poll', { limit: 120, windowMs: 60 * 1000 });
  if (!rl.ok) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: rateLimitHeaders(rl) });
  }

  let body: { device_code?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const deviceCode = typeof body.device_code === 'string' ? body.device_code : '';
  if (!deviceCode) return NextResponse.json({ error: 'device_code required' }, { status: 400 });

  const row = await db.query.pluginDeviceCodes.findFirst({
    where: eq(pluginDeviceCodes.deviceCodeHash, hashDeviceCode(deviceCode)),
  });
  // Unknown = expired — don't reveal whether a device code was ever issued.
  if (!row) return NextResponse.json({ status: 'expired' });

  const now = Date.now();

  // slow_down pacing (RFC 8628): a too-soon poll doesn't advance the clock, so the next allowed
  // poll is measured from the last HONORED one.
  if (row.lastPolledAt && now - Date.parse(row.lastPolledAt) < row.interval * 1000) {
    return NextResponse.json({ status: 'slow_down', interval: row.interval });
  }
  await db
    .update(pluginDeviceCodes)
    .set({ lastPolledAt: new Date(now).toISOString() })
    .where(eq(pluginDeviceCodes.id, row.id));

  // Lazy TTL expiry.
  if (now >= Date.parse(row.expiresAt)) {
    if (row.status === 'pending' || row.status === 'approved') {
      await db.update(pluginDeviceCodes).set({ status: 'expired' }).where(eq(pluginDeviceCodes.id, row.id));
    }
    return NextResponse.json({ status: 'expired' });
  }

  switch (row.status) {
    case 'denied':
      return NextResponse.json({ status: 'denied' });
    case 'expired':
    case 'redeemed': // single-use: an already-exchanged code is dead
      return NextResponse.json({ status: 'expired' });
    case 'approved': {
      if (row.userId == null) return NextResponse.json({ status: 'pending' });
      const user = await db.query.users.findFirst({ where: eq(users.id, row.userId) });
      // The account vanished or got banned between approve and poll — refuse cleanly.
      if (!user || user.banned) {
        await db.update(pluginDeviceCodes).set({ status: 'denied' }).where(eq(pluginDeviceCodes.id, row.id));
        return NextResponse.json({ status: 'denied' });
      }
      // Same lazy mint as the profile page — an existing token is reused, never rotated, so signing
      // in from a second client doesn't invalidate the first.
      let token = user.pluginToken;
      if (!token) {
        token = crypto.randomUUID();
        await db.update(users).set({ pluginToken: token }).where(eq(users.id, user.id));
      }
      await db.update(pluginDeviceCodes).set({ status: 'redeemed' }).where(eq(pluginDeviceCodes.id, row.id));
      return NextResponse.json({ status: 'complete', token });
    }
    default:
      return NextResponse.json({ status: 'pending' });
  }
}
