import { after, NextResponse } from 'next/server';

import { verifyPluginTokenUser } from '@/lib/auth';
import { CONTAINER_KINDS, type Snapshot } from '@/lib/gearOwnership';
import { accountForCharacter, accountStanding, playedCharacter } from '@/lib/pluginAccount';
import { cleanContainer, deleteSnapshotsForUser, saveSnapshot, saveTripState } from '@/lib/playerItems';
import { cleanTripState } from '@/lib/tripState';
import { TRIP_REGIONS } from '@/lib/tripContent';
import { warmTrip } from '@/lib/pluginUi/tripView';
import { clearTarget, currentTarget } from '@/lib/tripTargetStore';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';
import { worldModeIgnored } from '@/lib/worldModeRequest';

// PHASE 2 HOOK — the plugin's item push for guides. THE PLUGIN SENDS; THE SITE NEVER PULLS.
//
//   POST /api/plugin/items   Authorization: Bearer <account token>, X-RSN: <character>
//   { bank?:       { items: [{ id, q? }], readAt: ISO }   — on opening the bank
//     inventory?:  { items: [...], readAt }               — on change, debounced
//     equipment?:  { items: [...], readAt }               — on change, debounced
//     lootingBag?: { items: [...], readAt }               — when the plugin knows it
//     state?:      { book, pouch: [[runeId, qty]], pray }  — spellbook, rune pouch, unlocked
//                                                          prayers, for the pre-trip check (lib/tripState) }
//     tripEnd?:    true                                    — the trip ended (death, logout, hop):
//                                                          the next-trip target clears (lib/tripTarget)
//     region?:     12345                                   — where the player stands, sent with the bank:
//                                                          in a trip region (or with a target set) the
//                                                          check is worked out now (tripView warmTrip)
//   Only the containers sent are replaced; each keeps its own readAt. A body may carry only `state`.
//   Answers { ok, stored, armed }: `armed` says a next-trip target is set (capability 'trip-target'),
//   so the plugin asks for the 'trip' view when a bank closes anywhere, not only in a trip region.
//
//   DELETE /api/plugin/items  — the "Share my bank with Anvil for guides" setting was turned off:
//   every stored container for every character of this person goes, and the plugin sends nothing more.
//
// Only a character that is the token owner's own (accountStanding 'yours') is stored. What is
// stored is read back only by that person (lib/playerItems snapshotForViewer) — never clan staff.

async function ownAccount(request: Request): Promise<{ accountId: number; userId: number } | NextResponse> {
  const viewer = await verifyPluginTokenUser(request);
  if (!viewer) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const character = playedCharacter(request);
  if (!character) return NextResponse.json({ error: 'X-RSN required' }, { status: 400 });
  if ((await accountStanding(viewer.userId, character)) !== 'yours') return NextResponse.json({ error: 'Not your character' }, { status: 403 });
  const account = await accountForCharacter(character);
  if (!account) return NextResponse.json({ error: 'Unknown character' }, { status: 404 });
  return { accountId: account.id, userId: viewer.userId };
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
  // An unreadable state is dropped, not refused: the items in the same push still count.
  const state = body.state == null ? null : cleanTripState(body.state);
  const stored = await saveSnapshot(own.accountId, snap);
  if (state) await saveTripState(own.accountId, state);
  if (body.tripEnd === true) await clearTarget(own.accountId);
  const armed = !!(await currentTarget(own.userId, own.accountId).catch(() => null))?.target;
  // Banking for a trip: the bank-close ask will find the check already done.
  const region = Number.isInteger(body.region) ? (body.region as number) : null;
  if (snap.bank && (armed || (region != null && TRIP_REGIONS[region] && !TRIP_REGIONS[region].noBank))) after(() => warmTrip(request, region));
  return NextResponse.json({ ok: true, stored: stored + (state ? 1 : 0), armed });
}

export async function DELETE(request: Request) {
  // Every character of the token's person, not only the one logged in: sharing is off for them all.
  const viewer = await verifyPluginTokenUser(request);
  if (!viewer) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await deleteSnapshotsForUser(viewer.userId);
  return NextResponse.json({ ok: true });
}
