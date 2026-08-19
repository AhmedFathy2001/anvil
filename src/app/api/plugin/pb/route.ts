import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { memberPersonalBests } from '@/db/schema';
import { resolvePluginMember } from '@/lib/auth';
import { MAX_BESTS_PER_PUSH, normalizeBests, savePersonalBests, type IncomingBest } from '@/lib/personalBests';

// Personal-best ingest. Times are CENTISECONDS — the game separates runs by hundredths, and a
// leaderboard in whole seconds would tie times the game itself doesn't.
//
// The fastest-wins rule and the input validation both live in lib/personalBests, so this route is
// only auth + request shape. Profile data only — never scoring.

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

  const bests = normalizeBests(body.bests as IncomingBest[]);
  const updated = await savePersonalBests(member.clanMemberId, bests, new Date().toISOString());
  return NextResponse.json({ ok: true, updated });
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
    .where(and(eq(memberPersonalBests.accountId, member.accountId)));
  return NextResponse.json({ bests: rows });
}
