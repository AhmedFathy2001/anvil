import { NextResponse } from 'next/server';

import { verifyUser } from '@/lib/auth';
import {
  capForPlayer,
  challengesForPlayer,
  createChallenge,
  getH2hPrefs,
  myH2hCharacters,
  openCount,
  recordForPlayer,
} from '@/lib/h2h';
import { parseTarget } from '@/lib/h2hRules';
import { isMonsterDrop } from '@/lib/itemObtain';
import { getItemMapping } from '@/lib/osrsItems';
import { rateLimitByKey, rateLimitHeaders } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

// Head-to-head challenges (lib/h2h): the signed-in person's list, and sending a new one. A person's,
// never a clan's — challenges cross clans by nature, so this is a platform route.

export async function GET() {
  const session = await verifyUser();
  if (!session?.playerId) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  const [challenges, record, cap, open, prefs, characters] = await Promise.all([
    challengesForPlayer(session.playerId),
    recordForPlayer(session.playerId, false),
    capForPlayer(session.playerId),
    openCount(session.playerId),
    getH2hPrefs(session.playerId),
    myH2hCharacters(session.playerId),
  ]);
  return NextResponse.json({ challenges, record, cap, open, prefs, characters });
}

export async function POST(request: Request) {
  const session = await verifyUser();
  if (!session?.playerId) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  // Per person, in memory: stops a loop. The durable daily cap is lib/h2h's.
  const rl = await rateLimitByKey('h2h-create', String(session.playerId), { limit: 6, windowMs: 10 * 60_000 });
  if (!rl.ok) return NextResponse.json({ error: 'Slow down: try again in a few minutes.' }, { status: 429, headers: rateLimitHeaders(rl) });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Bad request' }, { status: 400 });

  let names = new Map<number, string>();
  if (body.kind === 'drop' && Array.isArray(body.itemIds)) {
    const wanted = new Set(body.itemIds.slice(0, 10).map(Number));
    const all = await getItemMapping().catch(() => []);
    names = new Map(all.filter((i) => wanted.has(i.id)).map((i) => [i.id, i.name]));
  }
  const parsed = parseTarget(body, { nameOf: (id) => names.get(id) ?? null, isDrop: isMonsterDrop });
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const accountId = Number(body.accountId);
  const opponentRsn = typeof body.opponentRsn === 'string' ? body.opponentRsn.slice(0, 20) : '';
  if (!Number.isInteger(accountId) || accountId <= 0) return NextResponse.json({ error: 'Pick your character.' }, { status: 400 });
  if (!opponentRsn.trim()) return NextResponse.json({ error: 'Who are you challenging?' }, { status: 400 });

  const out = await createChallenge({
    playerId: session.playerId,
    userId: session.userId,
    accountId,
    opponentRsn,
    target: parsed.target,
    itemNames: names,
    public: body.public === true,
  });
  if (!out.ok) return NextResponse.json({ error: out.error }, { status: out.status ?? 400 });
  return NextResponse.json({ id: out.id });
}
