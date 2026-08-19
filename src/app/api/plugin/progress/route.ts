import { NextResponse } from 'next/server';
import { db } from '@/db';
import { memberProgress, memberProgressItems } from '@/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { resolvePluginMember } from '@/lib/auth';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';
import { cleanProgress, progressUpdates } from '@/lib/memberProgress';
import { cleanItems, countDone, isItemCategory, serializeItems } from '@/lib/memberProgressItems';

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

  let body: { progress?: unknown; items?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // The item lists — which quests, later which combat tasks. Sent whole rather than diffed: the
  // list is one document per category, it changes a handful of times a year, and half a list is
  // worse than none. Stored only when it actually differs from what's held.
  let itemsStored = 0;
  const itemSets = Array.isArray(body?.items) ? body.items : [];
  for (const raw of itemSets) {
    if (!raw || typeof raw !== 'object') continue;
    const set = raw as { category?: unknown; items?: unknown };
    if (!isItemCategory(set.category)) continue;
    const items = cleanItems(set.items);
    if (items.length === 0) continue;
    const payload = serializeItems(items);
    const done = countDone(items);
    const existing = await db.query.memberProgressItems.findFirst({
      where: and(
        eq(memberProgressItems.clanMemberId, member.clanMemberId),
        eq(memberProgressItems.category, set.category),
      ),
    });
    if (existing?.payload === payload) continue;
    const now = new Date().toISOString();
    if (existing) {
      await db
        .update(memberProgressItems)
        .set({ payload, doneCount: done, totalCount: items.length, updatedAt: now })
        .where(eq(memberProgressItems.id, existing.id));
    } else {
      await db.insert(memberProgressItems).values({
        clanMemberId: member.clanMemberId,
        category: set.category,
        payload,
        doneCount: done,
        totalCount: items.length,
        updatedAt: now,
      });
    }
    itemsStored += 1;
  }

  const incoming = cleanProgress(Array.isArray(body?.progress) ? body.progress : []);
  if (incoming.size === 0) return NextResponse.json({ ok: true, updated: 0, itemsStored });

  const keys = [...incoming.keys()];
  const existing = await db
    .select({ key: memberProgress.key, value: memberProgress.value })
    .from(memberProgress)
    .where(and(eq(memberProgress.clanMemberId, member.clanMemberId), inArray(memberProgress.key, keys)));

  const updates = progressUpdates(new Map(existing.map((r) => [r.key, r.value])), incoming);
  if (updates.size === 0) return NextResponse.json({ ok: true, updated: 0, itemsStored });

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

  return NextResponse.json({ ok: true, updated: updates.size, itemsStored });
}
