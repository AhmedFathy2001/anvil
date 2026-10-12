import { NextResponse } from 'next/server';
import { verifyPluginTokenUser } from '@/lib/auth';
import { deleteGoal, listGoals, saveGoal } from '@/lib/goals';
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

const notYours = () =>
  NextResponse.json({ error: 'Log in to a character that is yours on Anvil to keep goals.' }, { status: 403 });

export async function GET(request: Request) {
  const owner = await ownedAccount(request);
  if (!owner) return notYours();
  return NextResponse.json({ goals: await listGoals(owner.accountId) });
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
  const refused = await saveGoal(owner.accountId, (body ?? {}) as Record<string, unknown>);
  if (refused) return NextResponse.json({ error: refused }, { status: 400 });
  return NextResponse.json({ goals: await listGoals(owner.accountId) });
}

export async function DELETE(request: Request) {
  const owner = await ownedAccount(request);
  if (!owner) return notYours();
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'Which goal?' }, { status: 400 });
  await deleteGoal(owner.accountId, id);
  return NextResponse.json({ goals: await listGoals(owner.accountId) });
}
