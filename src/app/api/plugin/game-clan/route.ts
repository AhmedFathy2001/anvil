import { NextResponse } from 'next/server';
import { foreignOr } from '@/lib/pluginForeign';

import { resolvePluginCharacter } from '@/lib/pluginAccount';
import { rateLimitByKey } from '@/lib/rate-limit';
import { parseGameClanReport } from '@/lib/gameClanReport';
import { recordGameClan, reportedAnvilClanId } from '@/lib/gameClans';
import { admit } from '@/lib/guestAdmission';

// POST /api/plugin/game-clan — { clan: { name, rank, title, joinedOn } | null }
//
// The logged-in character's OWN row from the in-game clan settings: which clan, what rank, since
// when. Sent on login and whenever the clan changes; `clan: null` means the plugin looked and they
// are in no clan. Never the member list — a ghost clan is built one consenting player at a time
// (lib/gameClans).
//
// Works for players with no Anvil clan at all, which is the point: resolvePluginCharacter takes a
// seat when there is one and otherwise a character this token owns outright — never one merely
// unclaimed. Nothing here grants membership anywhere.
export async function POST(request: Request) {
  const who = await resolvePluginCharacter(request);
  if (!who) {
    // Somebody else's character (or one this login let go of) says so (lib/pluginForeign).
    return foreignOr(
      request,
      NextResponse.json({ error: 'Unauthorized. Provide Authorization: Bearer <accountToken> + X-RSN' }, { status: 401 }),
    );
  }

  const rl = await rateLimitByKey('plugin-game-clan', String(who.accountId), { limit: 12, windowMs: 10 * 60_000 });
  if (!rl.ok) return NextResponse.json({ error: 'Too many pushes' }, { status: 429 });

  const report = parseGameClanReport(await request.json().catch(() => null));
  if (report === undefined) return NextResponse.json({ error: 'Expected { clan: {...} | null }' }, { status: 400 });

  const { stored } = await recordGameClan(who.accountId, report);
  // In a verified Anvil clan in game but not on its roster yet (the sync hasn't caught up): ask that
  // clan's staff. admit() returns an existing seat or pending request rather than filing another.
  if (report) {
    const clanId = await reportedAnvilClanId(who.accountId).catch(() => null);
    if (clanId != null) await admit({ clanId, accountId: who.accountId, source: 'plugin' }).catch(() => null);
  }
  return NextResponse.json({ ok: true, stored });
}
