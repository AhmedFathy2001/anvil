import { NextResponse } from 'next/server';

import { verifyPluginTokenUser } from '@/lib/auth';
import { CONTAINER_KINDS, type Snapshot } from '@/lib/gearOwnership';
import { accountForCharacter, accountStanding, playedCharacter } from '@/lib/pluginAccount';
import { cleanContainer, deleteSnapshotsForUser, saveSnapshot } from '@/lib/playerItems';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';
import { worldModeIgnored } from '@/lib/worldModeRequest';

// PHASE 2 HOOK — the plugin's item push for guides. THE PLUGIN SENDS; THE SITE NEVER PULLS.
//
//   POST /api/plugin/items   Authorization: Bearer <account token>, X-RSN: <character>
//   { bank?:       { items: [{ id, q? }], readAt: ISO }   — on opening the bank
//     inventory?:  { items: [...], readAt }               — on change, debounced
//     equipment?:  { items: [...], readAt }               — on change, debounced
//     lootingBag?: { items: [...], readAt }               — when the plugin knows it }
//   Only the containers sent are replaced; each keeps its own readAt.
//
//   DELETE /api/plugin/items  — the "Share my bank with Anvil for guides" setting was turned off:
//   every stored container for every character of this person goes, and the plugin sends nothing more.
//
// Only a character that is the token owner's own (accountStanding 'yours') is stored. What is
// stored is read back only by that person (lib/playerItems snapshotForViewer) — never clan staff.

async function ownAccount(request: Request): Promise<{ accountId: number } | NextResponse> {
  const viewer = await verifyPluginTokenUser(request);
  if (!viewer) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const character = playedCharacter(request);
  if (!character) return NextResponse.json({ error: 'X-RSN required' }, { status: 400 });
  if ((await accountStanding(viewer.userId, character)) !== 'yours') return NextResponse.json({ error: 'Not your character' }, { status: 403 });
  const account = await accountForCharacter(character);
  if (!account) return NextResponse.json({ error: 'Unknown character' }, { status: 404 });
  return { accountId: account.id };
}

export async function POST(request: Request) {
  const otherSave = worldModeIgnored(request);
  if (otherSave) return otherSave;
  const rl = await rateLimit(request, 'plugin-items', { limit: 30, windowMs: 60_000 });
  if (!rl.ok) return NextResponse.json({ error: 'Too many pushes' }, { status: 429, headers: rateLimitHeaders(rl) });
  const own = await ownAccount(request);
  if (own instanceof NextResponse) return own;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  const snap: Snapshot = {};
  for (const kind of CONTAINER_KINDS) {
    if (body[kind] == null) continue;
    const c = cleanContainer(kind, body[kind]);
    if (!c) return NextResponse.json({ error: `Bad ${kind}` }, { status: 400 });
    snap[kind] = c;
  }
  const stored = await saveSnapshot(own.accountId, snap);
  return NextResponse.json({ ok: true, stored });
}

export async function DELETE(request: Request) {
  // Every character of the token's person, not only the one logged in: sharing is off for them all.
  const viewer = await verifyPluginTokenUser(request);
  if (!viewer) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await deleteSnapshotsForUser(viewer.userId);
  return NextResponse.json({ ok: true });
}
