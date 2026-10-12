import { NextResponse } from 'next/server';
import { and, asc, count, eq } from 'drizzle-orm';

import { db } from '@/db';
import { playerGoals } from '@/db/schema';
import { verifyPluginTokenUser } from '@/lib/auth';
import { checkGoal, MAX_GOALS } from '@/lib/goalRules';
import { accountForCharacter, accountStanding, playedCharacter } from '@/lib/pluginAccount';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';

/**
 * The plugin's goals: GET lists, POST {kind, metric, target} adds (or retargets), DELETE ?id= removes.
 *
 * On the character being played (X-RSN), and only one the Account Token OWNS — the same test the
 * no-clan stats path uses. No clan needed: a goal is the player's, not their clan's. Advertised as the
 * `goals` capability.
 */

export const dynamic = 'force-dynamic';

async function ownedAccount(request: Request) {
  const viewer = await verifyPluginTokenUser(request);
  const character = playedCharacter(request);
  if (!viewer || !character) return null;
  if ((await accountStanding(viewer.userId, character)) !== 'yours') return null;
  const account = await accountForCharacter(character);
  return account ? { userId: viewer.userId, accountId: account.id } : null;
}

function list(accountId: number) {
  // clan-scope: global -- goals belong to an account, not a clan.
  return db
    .select({ id: playerGoals.id, kind: playerGoals.kind, metric: playerGoals.metric, target: playerGoals.target })
    .from(playerGoals)
    .where(eq(playerGoals.accountId, accountId))
    .orderBy(asc(playerGoals.id));
}

const notYours = () =>
  NextResponse.json({ error: 'Log in to a character that is yours on Anvil to keep goals.' }, { status: 403 });

export async function GET(request: Request) {
  const owner = await ownedAccount(request);
  if (!owner) return notYours();
  return NextResponse.json({ goals: await list(owner.accountId) });
}

export async function POST(request: Request) {
  const owner = await ownedAccount(request);
  if (!owner) return notYours();
  const rl = await rateLimit(request, `plugin-goals:${owner.userId}`, { limit: 30, windowMs: 60_000 });
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: rateLimitHeaders(rl) });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const goal = checkGoal((body ?? {}) as Record<string, unknown>);
  if (!goal.ok) return NextResponse.json({ error: goal.error }, { status: 400 });

  // clan-scope: global -- goals belong to an account, not a clan.
  const existing = await db.query.playerGoals.findFirst({
    where: and(eq(playerGoals.accountId, owner.accountId), eq(playerGoals.kind, goal.kind), eq(playerGoals.metric, goal.metric)),
    columns: { id: true },
  });
  if (existing) {
    // Same goal again = a new target for it, not a duplicate.
    await db.update(playerGoals).set({ target: goal.target }).where(eq(playerGoals.id, existing.id));
  } else {
    const [{ n }] = await db.select({ n: count() }).from(playerGoals).where(eq(playerGoals.accountId, owner.accountId));
    if (n >= MAX_GOALS) return NextResponse.json({ error: `Up to ${MAX_GOALS} goals — remove one first.` }, { status: 400 });
    await db.insert(playerGoals).values({
      accountId: owner.accountId,
      kind: goal.kind,
      metric: goal.metric,
      target: goal.target,
      createdAt: new Date().toISOString(),
    }).onConflictDoNothing();
  }
  return NextResponse.json({ goals: await list(owner.accountId) });
}

export async function DELETE(request: Request) {
  const owner = await ownedAccount(request);
  if (!owner) return notYours();
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'Which goal?' }, { status: 400 });
  // clan-scope: global -- scoped to the caller's own account by the WHERE.
  await db.delete(playerGoals).where(and(eq(playerGoals.id, id), eq(playerGoals.accountId, owner.accountId)));
  return NextResponse.json({ goals: await list(owner.accountId) });
}
