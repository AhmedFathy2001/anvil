import { NextResponse } from 'next/server';

import { verifyPluginTokenUser } from '@/lib/auth';
import { prefsFromRuneLite } from '@/lib/notifyPrefs';
import { hasNotifyPrefs, setNotifyPrefs } from '@/lib/notifyPrefsStore';
import { rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * POST /api/plugin/notify-prefs — the plugin's ONE-TIME hand-over of the notify settings it used to keep
 * in RuneLite config (capability 'notify-prefs'): `{ prefs: { notifyRareDrops: "false", … } }`, the raw
 * stored strings under their old keys. Only fills a person who has never saved prefs, so a second
 * install (or a second RuneLite profile) can't overwrite what they've since chosen on /settings.
 */
export async function POST(request: Request) {
  const auth = await verifyPluginTokenUser(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const limit = await rateLimit(request, `plugin-notify-prefs:${auth.userId}`, { limit: 10, windowMs: 60_000 });
  if (!limit.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  const body = (await request.json().catch(() => null)) as { prefs?: unknown } | null;
  if (!body?.prefs || typeof body.prefs !== 'object') return NextResponse.json({ error: 'Bad body' }, { status: 400 });
  if (await hasNotifyPrefs(auth.userId)) return NextResponse.json({ ok: true, kept: true });
  await setNotifyPrefs(auth.userId, prefsFromRuneLite(body.prefs as Record<string, unknown>));
  return NextResponse.json({ ok: true });
}
