import { NextResponse } from 'next/server';

import { verifyUser } from '@/lib/auth';
import { getH2hPrefs, setH2hPrefs } from '@/lib/h2h';

export const dynamic = 'force-dynamic';

// Your head-to-head settings: turn every invitation away, or lift a block.

export async function PUT(request: Request) {
  const session = await verifyUser();
  if (!session?.playerId) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { closed?: unknown; unblock?: unknown } | null;
  if (!body) return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  const cur = await getH2hPrefs(session.playerId);
  const unblock = Number(body.unblock);
  const next = await setH2hPrefs(session.playerId, {
    ...(typeof body.closed === 'boolean' ? { closed: body.closed } : {}),
    ...(body.unblock === 'all' ? { blocked: [] } : {}),
    ...(Number.isInteger(unblock) && unblock > 0 ? { blocked: cur.blocked.filter((p) => p !== unblock) } : {}),
  });
  return NextResponse.json({ prefs: next });
}
