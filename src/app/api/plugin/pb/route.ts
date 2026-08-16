import { NextResponse } from 'next/server';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { memberPersonalBests } from '@/db/schema';
import { resolvePluginMember } from '@/lib/auth';

// Personal-best ingest. Times are CENTISECONDS — the game separates runs by hundredths, and a
// leaderboard in whole seconds would tie times the game itself doesn't.
//
// The server keeps the FASTEST of stored and pushed, never the latest. That single rule makes the
// endpoint idempotent and order-independent: a retry, a stale client, or two accounts of the same
// person pushing out of order can't raise somebody's record. It's also why the plugin can send its
// whole set on a whim without us needing to reason about what we already had.
//
// Profile data only — never scoring.

/** 24 hours. Longer than any real clear, short enough to reject a parse that went wrong. */
const MAX_CENTIS = 24 * 60 * 60 * 100;
const MAX_BESTS_PER_PUSH = 200;
/** Raids cap out well below this; the ceiling exists to reject nonsense, not to model the game. */
const MAX_TEAM_SIZE = 100;

interface IncomingBest {
  activity?: unknown;
  centis?: unknown;
  teamSize?: unknown;
}

export async function POST(request: Request) {
  const member = await resolvePluginMember(request);
  if (!member) {
    return NextResponse.json(
      { error: 'Unauthorized. Provide Authorization: Bearer <accountToken> + X-RSN' },
      { status: 401 },
    );
  }

  let body: { bests?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!Array.isArray(body?.bests) || body.bests.length === 0) {
    return NextResponse.json({ error: 'bests[] required' }, { status: 400 });
  }
  if (body.bests.length > MAX_BESTS_PER_PUSH) {
    return NextResponse.json({ error: `At most ${MAX_BESTS_PER_PUSH} bests per push` }, { status: 400 });
  }

  const nowIso = new Date().toISOString();
  // Deduped in memory first: one push can legitimately carry the same activity twice (an alt's
  // import merged with live capture), and the fastest should win before it reaches the database.
  const best = new Map<string, { activity: string; teamSize: number; centis: number }>();

  for (const raw of body.bests as IncomingBest[]) {
    const activity =
      typeof raw?.activity === 'string' ? raw.activity.trim().toLowerCase().slice(0, 80) : '';
    if (!activity) continue;
    const centis =
      typeof raw?.centis === 'number' && Number.isFinite(raw.centis) && raw.centis > 0 && raw.centis <= MAX_CENTIS
        ? Math.floor(raw.centis)
        : null;
    if (centis == null) continue;
    // 0 means "this activity has no team sizes" — see the schema note on why it isn't null.
    const teamSize =
      typeof raw?.teamSize === 'number' && Number.isFinite(raw.teamSize) && raw.teamSize > 0 && raw.teamSize <= MAX_TEAM_SIZE
        ? Math.floor(raw.teamSize)
        : 0;

    // \u0000 as the separator, written as an escape: a literal NUL in the source makes git treat
    // this file as binary — no diffs, no blame — and it's invisible in an editor.
    const key = `${activity}\u0000${teamSize}`;
    const existing = best.get(key);
    if (!existing || centis < existing.centis) best.set(key, { activity, teamSize, centis });
  }

  if (best.size === 0) {
    return NextResponse.json({ ok: true, updated: 0 });
  }

  // One statement, and the conflict clause is where the "fastest wins" rule actually lives —
  // doing it as read-then-write would race two clients of the same account against each other.
  const values = [...best.values()].map((b) => ({
    clanMemberId: member.clanMemberId,
    activity: b.activity,
    teamSize: b.teamSize,
    centis: b.centis,
    achievedAt: nowIso,
    updatedAt: nowIso,
  }));

  await db
    .insert(memberPersonalBests)
    .values(values)
    .onConflictDoUpdate({
      target: [memberPersonalBests.clanMemberId, memberPersonalBests.activity, memberPersonalBests.teamSize],
      set: {
        centis: sql`min(${memberPersonalBests.centis}, excluded.centis)`,
        // Only stamp the date when this push actually improved the record; otherwise a re-import
        // would redate every best a player has ever set to today.
        achievedAt: sql`case when excluded.centis < ${memberPersonalBests.centis} then excluded.achieved_at else ${memberPersonalBests.achievedAt} end`,
        updatedAt: nowIso,
      },
    });

  return NextResponse.json({ ok: true, updated: values.length });
}

export async function GET(request: Request) {
  const member = await resolvePluginMember(request);
  if (!member) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const rows = await db
    .select({
      activity: memberPersonalBests.activity,
      teamSize: memberPersonalBests.teamSize,
      centis: memberPersonalBests.centis,
    })
    .from(memberPersonalBests)
    .where(and(eq(memberPersonalBests.clanMemberId, member.clanMemberId)));
  return NextResponse.json({ bests: rows });
}
