import { NextResponse } from 'next/server';

import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyPluginTokenUser } from '@/lib/auth';
import { getGuide } from '@/lib/guides';
import { guideViewer, EMPTY_VIEWER } from '@/lib/guideViewer';
import { exportText, loadGuideView, type ExportKind } from '@/lib/guideView';
import { rateLimit } from '@/lib/rate-limit';

// PHASE 2 HOOK — what the plugin's "copy" action fetches (pluginUi guideUi COPY action):
//   GET /api/plugin/guide-export?guide=<id>&setup=<key>&kind=banktag|setup|markers[&mine=1]
//   → { text }   plain text for the clipboard: a Bank Tags string, an Inventory Setups JSON, or a
//                Ground Markers JSON. mine=1 = the reader's own version (fallbacks, skips, budget),
//                from the token owner's own items only.
// Text only: the plugin puts it on the clipboard and shows nothing it doesn't draw itself.
export async function GET(request: Request) {
  const rl = await rateLimit(request, 'plugin-guide-export', { limit: 60, windowMs: 60_000 });
  if (!rl.ok) return NextResponse.json({ error: 'Too many' }, { status: 429 });
  const u = new URL(request.url);
  const guide = await getGuide(Number(u.searchParams.get('guide')));
  const key = u.searchParams.get('setup') ?? '';
  const kind = u.searchParams.get('kind') as ExportKind;
  if (!guide || guide.status !== 'published' || !/^[a-z0-9-]{1,60}$/.test(key) || !['banktag', 'setup', 'markers'].includes(kind)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const mine = u.searchParams.get('mine') === '1';
  const login = mine ? await verifyPluginTokenUser(request) : null;
  const row = login ? await db.query.users.findFirst({ where: eq(users.id, login.userId), columns: { playerId: true } }) : null;
  const viewer = login && row?.playerId ? await guideViewer({ userId: login.userId, playerId: row.playerId }, { items: true }) : EMPTY_VIEWER;
  const view = await loadGuideView(guide, viewer);
  const setup = view.setups.find((s) => s.key === key);
  if (!setup) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ text: exportText(guide, setup, view.block, kind, mine) }, { headers: { 'Cache-Control': 'private, no-store' } });
}
