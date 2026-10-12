import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { accounts } from '@/db/schema';
import { verifyUser } from '@/lib/auth';
import { deleteGoal, listGoals, saveGoal } from '@/lib/goals';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';

/**
 * Goals from the website — the same goals the plugin's You tab sets (lib/goals), edited from the
 * character's profile page. Signed-in session; only for a character the person owns.
 * POST {accountId, kind, metric, target} adds or retargets; DELETE ?accountId=&id= removes.
 */

export const dynamic = 'force-dynamic';

async function ownedAccountId(accountId: unknown): Promise<{ accountId: number; playerId: number } | null> {
  const session = await verifyUser();
  const id = Number(accountId);
  if (!session || !Number.isInteger(id) || id <= 0) return null;
  // clan-scope: global -- an OSRS account is one account however many clans roster it.
  const acct = await db.query.accounts.findFirst({ where: eq(accounts.id, id), columns: { playerId: true } });
  return acct && acct.playerId === session.playerId ? { accountId: id, playerId: session.playerId } : null;
}

const notYours = () => NextResponse.json({ error: 'Only the owner can change these goals.' }, { status: 403 });

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const owner = await ownedAccountId(body?.accountId);
  if (!owner) return notYours();
  const rl = await rateLimit(request, `profile-goals:${owner.playerId}`, { limit: 30, windowMs: 60_000 });
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: rateLimitHeaders(rl) });
  const refused = await saveGoal(owner.accountId, body);
  if (refused) return NextResponse.json({ error: refused }, { status: 400 });
  return NextResponse.json({ goals: await listGoals(owner.accountId) });
}

export async function DELETE(request: Request) {
  const params = new URL(request.url).searchParams;
  const owner = await ownedAccountId(params.get('accountId'));
  if (!owner) return notYours();
  const id = Number(params.get('id'));
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'Which goal?' }, { status: 400 });
  await deleteGoal(owner.accountId, id);
  return NextResponse.json({ goals: await listGoals(owner.accountId) });
}
