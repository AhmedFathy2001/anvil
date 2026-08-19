import { NextResponse } from 'next/server';
import { db } from '@/db';
import { memberProgress } from '@/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { resolvePluginMember } from '@/lib/auth';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';
import { cleanProgress, progressUpdates } from '@/lib/memberProgress';

// POST /api/plugin/progress — quest points, combat-achievement points/tier, and diary counts.
//
// The hiscores don't publish any of it, so without this push the site can't answer "how many QP does
// this member have" or "who has cleared Master combat achievements" — questions a clan asks
// constantly and which the game itself knows exactly.
//
// Member-level auth like /api/plugin/stats: no live event required, because this is account state
// rather than event scoring. Nothing here feeds a standing, a tile or a payout.
//
// The plugin sends only keys whose value CHANGED since its last successful push, and the server
// writes only the ones that actually moved — so the steady state is an empty body that never runs
// an UPDATE.

export async function POST(request: Request) {
  const rl = await rateLimit(request, 'plugin-progress', { limit: 30, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json({ error: 'Too many pushes' }, { status: 429, headers: rateLimitHeaders(rl) });
  }

  const member = await resolvePluginMember(request);
  if (!member) {
    return NextResponse.json(
      { error: 'Unauthorized. Provide Authorization: Bearer <accountToken> + X-RSN' },
      { status: 401 },
    );
  }

  let body: { progress?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const incoming = cleanProgress(Array.isArray(body?.progress) ? body.progress : []);
  if (incoming.size === 0) return NextResponse.json({ ok: true, updated: 0 });

  const keys = [...incoming.keys()];
  const existing = await db
    .select({ key: memberProgress.key, value: memberProgress.value })
    .from(memberProgress)
    .where(and(eq(memberProgress.clanMemberId, member.clanMemberId), inArray(memberProgress.key, keys)));

  const updates = progressUpdates(new Map(existing.map((r) => [r.key, r.value])), incoming);
  if (updates.size === 0) return NextResponse.json({ ok: true, updated: 0 });

  const now = new Date().toISOString();
  for (const [key, value] of updates) {
    await db
      .insert(memberProgress)
      .values({ clanMemberId: member.clanMemberId, key, value, updatedAt: now })
      .onConflictDoUpdate({
        target: [memberProgress.clanMemberId, memberProgress.key],
        set: { value, updatedAt: now },
      });
  }

  return NextResponse.json({ ok: true, updated: updates.size });
}
