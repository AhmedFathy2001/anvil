import { NextResponse } from 'next/server';
import { db } from '@/db';
import { eventParticipants, events } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { resolvePluginMember } from '@/lib/auth';

// Real-time ingest for the fun end-of-event "recap" counters (total deaths, total loot GP, and PvP
// kills for the active event). The plugin pushes ABSOLUTE per-event totals — idempotent, so a retry
// or a client restart mid-event can't double-count: we keep max(stored, pushed) per counter. Purely
// cosmetic (feeds the superlatives recap only, never scoring). No screenshot, no active-tile
// requirement — pvpKills in particular exists so the PKer superlative works with no pvp tile on the
// board.

// Sanity ceilings — reject obviously bogus pushes. Loot GP stays well under 2^53 (~9 quadrillion), so
// the JS-number-backed integer column keeps full precision.
const MAX_DEATHS = 100_000;
const MAX_LOOT_GP = 1_000_000_000_000; // 1 trillion
const MAX_PVP_KILLS = 100_000;
// A hitsplat can't exceed the game's own ceiling by any honest route; minutes are capped at a year
// of continuous play, which no real event approaches.
const MAX_HIT = 10_000;
const MAX_MINUTES = 525_600;
// There are ~640 combat tasks in the game, so anything near this is a client with a bug.
const MAX_CA_TASKS = 2_000;

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

  let body: {
    deaths?: unknown;
    lootGp?: unknown;
    pvpKills?: unknown;
    biggestHit?: unknown;
    minutesPlayed?: unknown;
    caTasks?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const deaths = clampCounter(body?.deaths, MAX_DEATHS);
  const lootGp = clampCounter(body?.lootGp, MAX_LOOT_GP);
  const pvpKills = clampCounter(body?.pvpKills, MAX_PVP_KILLS);
  // Added after the first three. A plugin that predates them omits both keys entirely, which
  // clampCounter reads as null — "leave whatever is stored alone" — so older clients keep working
  // unchanged and simply never win these two awards.
  const biggestHit = clampCounter(body?.biggestHit, MAX_HIT);
  const minutesPlayed = clampCounter(body?.minutesPlayed, MAX_MINUTES);
  // Combat tasks FIRST completed during the event. Same absent-means-leave-it contract as the two
  // above, so a plugin that predates it simply never wins Task Master.
  const caTasks = clampCounter(body?.caTasks, MAX_CA_TASKS);
  if (deaths == null && lootGp == null && pvpKills == null && biggestHit == null && minutesPlayed == null && caTasks == null) {
    return NextResponse.json({ ok: true, updated: 0 });
  }

  const nowIso = new Date().toISOString();

  // Resolve the member's active-event player row (same rule the stats ingest uses): drafted onto a team,
  // event not force-ended and not past its end date. Counters are per-event, so they land on that row.
  // clan-scope: global -- takes an entity id whose caller has already settled the clan — the 'one hop, never a copy' rule in lib/eventScope. Every route and page that reaches this is verified scoped.
  const playerRows = await db
    .select({
      id: eventParticipants.id,
      teamId: eventParticipants.teamId,
      deaths: eventParticipants.deaths,
      lootGpGained: eventParticipants.lootGpGained,
      pvpKills: eventParticipants.pvpKills,
      biggestHit: eventParticipants.biggestHit,
      minutesPlayed: eventParticipants.minutesPlayed,
      caTasks: eventParticipants.caTasks,
      endDate: events.endDate,
      forceEndedAt: events.forceEndedAt,
    })
    .from(eventParticipants)
    .innerJoin(events, eq(eventParticipants.eventId, events.id))
    .where(eq(eventParticipants.clanMemberId, member.clanMemberId));
  const active = playerRows.find(
    (p) => p.teamId && !p.forceEndedAt && (!p.endDate || p.endDate > nowIso),
  );
  if (!active) {
    return NextResponse.json({ ok: true, updated: 0 });
  }

  // Absolute counts only ever rise — keep the max so a retry or restart never regresses the total.
  const curDeaths = active.deaths ?? 0;
  const curLoot = active.lootGpGained ?? 0;
  const curPvp = active.pvpKills ?? 0;
  const curHit = active.biggestHit ?? 0;
  const curMinutes = active.minutesPlayed ?? 0;
  const curCa = active.caTasks ?? 0;
  const newDeaths = deaths != null ? Math.max(curDeaths, deaths) : curDeaths;
  const newLoot = lootGp != null ? Math.max(curLoot, lootGp) : curLoot;
  const newPvp = pvpKills != null ? Math.max(curPvp, pvpKills) : curPvp;
  // Both are high-water marks too: a hardest hit never gets softer, and play time only accrues —
  // so a client that restarts mid-event and re-pushes can't walk either number backwards.
  const newHit = biggestHit != null ? Math.max(curHit, biggestHit) : curHit;
  const newMinutes = minutesPlayed != null ? Math.max(curMinutes, minutesPlayed) : curMinutes;
  const newCa = caTasks != null ? Math.max(curCa, caTasks) : curCa;

  if (
    newDeaths !== curDeaths ||
    newLoot !== curLoot ||
    newPvp !== curPvp ||
    newHit !== curHit ||
    newMinutes !== curMinutes ||
    newCa !== curCa
  ) {
    await db
      .update(eventParticipants)
      .set({
        deaths: newDeaths,
        lootGpGained: newLoot,
        pvpKills: newPvp,
        biggestHit: newHit,
        minutesPlayed: newMinutes,
        caTasks: newCa,
      })
      .where(eq(eventParticipants.id, active.id));
    return NextResponse.json({ ok: true, updated: 1 });
  }
  return NextResponse.json({ ok: true, updated: 0 });
}
