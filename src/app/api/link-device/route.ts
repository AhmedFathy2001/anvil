import { NextResponse } from 'next/server';
import { verifyUser } from '@/lib/auth';
import { normalizeUserCode, resolveUserCode } from '@/lib/pluginDeviceAuth';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

// POST /api/link-device — the logged-in member approves (or denies) the code their RuneLite client
// is showing. Requires a full web session; binding happens here, the token is only ever released to
// the POLLING plugin (never to the browser).
export async function POST(request: Request) {
  const session = await verifyUser();
  if (!session?.userId) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  // Brute-forcing 8-char codes through this endpoint must be pointless.
  const rl = await rateLimit(request, 'link-device', { limit: 15, windowMs: 5 * 60 * 1000 });
  if (!rl.ok) {
    return NextResponse.json({ error: 'Too many attempts — wait a bit.' }, { status: 429, headers: rateLimitHeaders(rl) });
  }

  let body: { code?: string; action?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const code = normalizeUserCode(typeof body.code === 'string' ? body.code : '');
  if (!code) return NextResponse.json({ error: 'That doesn’t look like a valid code.' }, { status: 400 });
  const action = body.action === 'deny' ? 'deny' : 'approve';

  const ok = await resolveUserCode(code, session.userId, action);
  if (!ok) {
    return NextResponse.json(
      { error: 'Code not found — it may have expired. Start the sign-in again from RuneLite.' },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true, action });
}
