import { NextResponse } from 'next/server';
import { foreignOr } from '@/lib/pluginForeign';

import { setGuestPresence } from '@/lib/chatFeed';
import { resolvePluginCharacter } from '@/lib/pluginAccount';
import { rateLimitByKey } from '@/lib/rate-limit';

// POST /api/plugin/presence — capability 'chat-feed'. { guestChannel: string | null }
//
// The clan whose GUEST channel the logged-in character sits in right now (null = none). Sent when it
// changes and every few minutes while it stays (lib/chatFeed GUEST_PRESENCE_TTL_MS), and only while the
// plugin's feed switch is on. This is what the guest bridge reads — never the stored guest seat, which
// is everyone who ever guested.
export async function POST(request: Request) {
  const who = await resolvePluginCharacter(request);
  if (!who) return foreignOr(request, NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
  const rl = await rateLimitByKey('plugin-presence', String(who.accountId), { limit: 20, windowMs: 10 * 60_000 });
  if (!rl.ok) return NextResponse.json({ error: 'Too many reports' }, { status: 429 });
  const body = await request.json().catch(() => null);
  const raw = body?.guestChannel;
  if (raw !== null && typeof raw !== 'string') {
    return NextResponse.json({ error: 'Expected { guestChannel: string | null }' }, { status: 400 });
  }
  const clan = await setGuestPresence(who.accountId, who.userId, raw ? raw.slice(0, 40) : null);
  return NextResponse.json({ ok: true, clan: clan?.name ?? null });
}
