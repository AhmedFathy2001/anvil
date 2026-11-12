import { NextResponse } from 'next/server';

import { verifyPluginTokenUser } from '@/lib/auth';
import { reportRelayLine } from '@/lib/chatRelay';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';

// POST /api/plugin/chat-relay/report — the plugin's right-click "Report to Anvil" on a relayed chat
// line (lib/push/relay). Body: the line as it arrived ({c, n, x, at, u, k}). Only a line the push
// server signed is accepted, and only that line is stored (lib/chatRelay reportRelayLine).
export async function POST(request: Request) {
  const user = await verifyPluginTokenUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const rl = await rateLimit(request, `plugin-relay-report:${user.userId}`, { limit: 10, windowMs: 10 * 60_000 });
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: rateLimitHeaders(rl) });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  const r = await reportRelayLine(user.userId, body);
  return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.error }, { status: 400 });
}
