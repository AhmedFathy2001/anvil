import { NextResponse } from 'next/server';

import { verifyPluginTokenUser } from '@/lib/auth';
import { chatboxChans } from '@/lib/pluginUi/feedView';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';

// GET /api/plugin/chat-chans — the channels the plugin's chatbox event chat input cycles through (its
// key, and the Clan tab's right-click entries), labelled and in order (lib/pluginUi/feedView
// chatboxChans). A line typed there is sent with the Feed tab's own action (chat-send, args e + to),
// so who may post where stays the Feed tab's rule.
export async function GET(request: Request) {
  const user = await verifyPluginTokenUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const rl = await rateLimit(request, `plugin-chat-chans:${user.userId}`, { limit: 30, windowMs: 60_000 });
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: rateLimitHeaders(rl) });
  return NextResponse.json(await chatboxChans(request, user.userId), { headers: { 'Cache-Control': 'no-store' } });
}
