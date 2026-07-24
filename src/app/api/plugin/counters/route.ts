import { NextResponse } from 'next/server';
import { db } from '@/db';
import { players, events } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { resolvePluginMember } from '@/lib/auth';

// Real-time ingest for the fun end-of-event "recap" counters (total deaths + total loot GP for the
// active event). The plugin pushes ABSOLUTE per-event totals — idempotent, so a retry or a client
// restart mid-event can't double-count: we keep max(stored, pushed) per counter. Purely cosmetic
// (feeds the superlatives recap only, never scoring). No screenshot, no active-tile requirement.

// Sanity ceilings — reject obviously bogus pushes. Loot GP stays well under 2^53 (~9 quadrillion), so
// the JS-number-backed integer column keeps full precision.
const MAX_DEATHS = 100_000;
const MAX_LOOT_GP = 1_000_000_000_000; // 1 trillion

// Coerce a pushed value into a clean non-negative integer within [0, max]; anything else → null (absent).
function clampCounter(v: unknown, max: number): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > max) return null;
  return Math.floor(v);
}

export async function POST(request: Request) {
  const member = await resolvePluginMember(request);
  if (!member) {
    return NextResponse.json({ error: 'Unauthorized. Provide Authorization: Bearer <accountToken> + X-RSN' }, { status: 401 });
  }

  let body: { deaths?: unknown; lootGp?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const deaths = clampCounter(body?.deaths, MAX_DEATHS);
  const lootGp = clampCounter(body?.lootGp, MAX_LOOT_GP);
  if (deaths == null && lootGp == null) {
    return NextResponse.json({ ok: true, updated: 0 });
  }

  const nowIso = new Date().toISOString();

  // Resolve the member's active-event player row (same rule the stats ingest uses): drafted onto a team,
  // event not force-ended and not past its end date. Counters are per-event, so they land on that row.
  const playerRows = await db
    .select({
      id: players.id,
      teamId: players.teamId,
      deaths: players.deaths,
      lootGpGained: players.lootGpGained,
      endDate: events.endDate,
      forceEndedAt: events.forceEndedAt,
    })
    .from(players)
    .innerJoin(events, eq(players.eventId, events.id))
    .where(eq(players.clanMemberId, member.clanMemberId));
  const active = playerRows.find(
    (p) => p.teamId && !p.forceEndedAt && (!p.endDate || p.endDate > nowIso),
  );
  if (!active) {
    return NextResponse.json({ ok: true, updated: 0 });
  }

  // Absolute counts only ever rise — keep the max so a retry or restart never regresses the total.
  const curDeaths = active.deaths ?? 0;
  const curLoot = active.lootGpGained ?? 0;
  const newDeaths = deaths != null ? Math.max(curDeaths, deaths) : curDeaths;
  const newLoot = lootGp != null ? Math.max(curLoot, lootGp) : curLoot;

  if (newDeaths !== curDeaths || newLoot !== curLoot) {
    await db.update(players).set({ deaths: newDeaths, lootGpGained: newLoot }).where(eq(players.id, active.id));
    return NextResponse.json({ ok: true, updated: 1 });
  }
  return NextResponse.json({ ok: true, updated: 0 });
}
