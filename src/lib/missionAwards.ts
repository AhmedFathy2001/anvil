import { db } from '@/db';
import { cofferEntries, completions, eventParticipants, events, submissions, teams, tiles } from '@/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import {
  decayedPoints,
  isMissionTile,
  missionOffersGp,
  missionPlaceGp,
  missionPlacePoints,
  parseTileMissionRules,
  type MissionRules,
} from '@/lib/eventRules';
import { recordUnfundedAward, reserveAward, findAwardForCompletion } from '@/lib/coffer';
import { parseStamp } from '@/lib/dbTime';
import { log } from '@/lib/logger';

// Turning a mission claim into money.
//
// Points are frozen by the completion gate at insert time; gp cannot be, because reserving it is a
// WRITE and the gate is a decision. So the settle pass runs behind every completion path at once —
// the plugin push, the hiscores sweep, a submission auto-credit, an admin's manual toggle — instead
// of being wired into each of them and forgotten in the fifth. It is idempotent (one award per
// completion, enforced by a unique index), so the per-minute mission tick can simply re-run it.
//
// The pass is also where the funding question gets its FINAL answer. The gate guessed, against the
// balance a moment earlier, so the points it wrote could be right; here the reservation either
// succeeds or doesn't, and the points are corrected to match what actually happened. The money and
// the leaderboard never get to disagree about the same claim — which is the whole reason the two
// live in one file.

type EventRow = typeof events.$inferSelect;
type TileRow = typeof tiles.$inferSelect;

export interface SettledAward {
  completionId: number;
  tileId: number;
  tileLabel: string;
  place: number;
  /** The gp actually reserved. 0 when the coffer could not cover the prize. */
  gp: number;
  /** What the place was owed, funded or not — the number worth announcing either way. */
  offeredGp: number;
  funded: boolean;
  /** Points this claim ends up holding, after any correction. Null on a non-points event. */
  points: number | null;
  rsn: string | null;
  teamId: number;
}

/**
 * Settle every unpaid mission claim on one event. Returns only the awards decided THIS pass, so a
 * caller can announce them exactly once.
 */
export async function settleMissionAwards(event: EventRow, missionTiles?: TileRow[]): Promise<SettledAward[]> {
  // clan-scope: global -- takes an event row whose clan the caller has already settled.
  const all = missionTiles ?? (await db.select().from(tiles).where(eq(tiles.eventId, event.id)));
  // Only missions that promise money need any of this; a points-only ladder is settled the moment
  // the gate writes awardedPoints.
  const paying = all
    .filter((t) => isMissionTile(t) && t.revealedAt != null)
    .map((t) => ({ tile: t, rules: parseTileMissionRules(t.rules) }))
    .filter((m) => missionOffersGp(m.rules));
  if (paying.length === 0) return [];

  const tileIds = paying.map((m) => m.tile.id);
  const claims = await db
    .select({
      id: completions.id,
      tileId: completions.tileId,
      teamId: completions.teamId,
      completedAt: completions.completedAt,
      awardedPoints: completions.awardedPoints,
      creditPlayerId: completions.creditPlayerId,
    })
    .from(completions)
    .where(inArray(completions.tileId, tileIds));
  if (claims.length === 0) return [];

  // Finishing order per tile. Ties on the stored second break by id, which is insertion order — the
  // same tie-break the gate used when it counted the rows already there.
  const byTile = new Map<number, typeof claims>();
  for (const c of claims) {
    const list = byTile.get(c.tileId) ?? [];
    list.push(c);
    byTile.set(c.tileId, list);
  }
  for (const list of byTile.values()) {
    list.sort((a, b) => (a.completedAt < b.completedAt ? -1 : a.completedAt > b.completedAt ? 1 : a.id - b.id));
  }

  const names = await resolveClaimants(event.id, claims);
  const settled: SettledAward[] = [];

  for (const { tile, rules } of paying) {
    const order = byTile.get(tile.id) ?? [];
    for (let i = 0; i < order.length; i++) {
      const claim = order[i];
      const place = i + 1;
      const offeredGp = missionPlaceGp(rules.reward, place);
      if (offeredGp <= 0) continue; // this place wins points only — nothing to settle here
      if (await findAwardForCompletion(claim.id)) continue; // already decided on an earlier pass

      const who = names.get(claim.id) ?? { clanMemberId: null, rsn: null };
      const award = await reserveAward({
        clanId: event.clanId,
        amount: offeredGp,
        eventId: event.id,
        tileId: tile.id,
        completionId: claim.id,
        place,
        clanMemberId: who.clanMemberId,
        rsn: who.rsn,
        note: `${tile.label} — place ${place}`,
      });
      const funded = award != null && award.status !== 'unfunded';
      if (!funded) {
        await recordUnfundedAward({
          clanId: event.clanId,
          amount: offeredGp,
          eventId: event.id,
          tileId: tile.id,
          completionId: claim.id,
          place,
          clanMemberId: who.clanMemberId,
          rsn: who.rsn,
        });
      }

      const points = await reconcilePoints({ event, tile, rules, claim, place, funded });
      settled.push({
        completionId: claim.id,
        tileId: tile.id,
        tileLabel: tile.label,
        place,
        gp: funded ? offeredGp : 0,
        offeredGp,
        funded,
        points,
        rsn: who.rsn,
        teamId: claim.teamId,
      });
      log.info('mission-award.settled', {
        eventId: event.id,
        tileId: tile.id,
        place,
        gp: funded ? offeredGp : 0,
        funded,
      });
    }
  }
  return settled;
}

/**
 * Make the frozen points agree with the funding decision that just landed.
 *
 * Almost always a no-op: the gate reads the same balance a second earlier and gets the same answer.
 * It bites when the coffer emptied between the claim and the settle — two winners racing the last
 * prize — and then the loser's points are rewritten from "you got the gp" to whatever the place is
 * worth unfunded, which is the number they should have had all along.
 *
 * The tile's value is recomputed AT THE CLAIM'S OWN TIMESTAMP, not now: a decaying mission is worth
 * less every minute, and re-freezing it at settle time would quietly shave points off a claim for
 * the crime of being settled a tick later.
 */
async function reconcilePoints(args: {
  event: EventRow;
  tile: TileRow;
  rules: MissionRules;
  claim: { id: number; completedAt: string; awardedPoints: number | null };
  place: number;
  funded: boolean;
}): Promise<number | null> {
  const { event, tile, rules, claim, place, funded } = args;
  if (event.scoringMode !== 'points') return null;
  const atMs = parseStamp(claim.completedAt) ?? Date.now();
  const base = decayedPoints(tile.points, tile.revealedAt, rules.decay, atMs);
  const should = missionPlacePoints({ reward: rules.reward, place, funded, baseValue: base });
  if (claim.awardedPoints === should) return should;
  await db.update(completions).set({ awardedPoints: should }).where(eq(completions.id, claim.id));
  log.info('mission-award.points-corrected', {
    completionId: claim.id,
    from: claim.awardedPoints,
    to: should,
    funded,
  });
  return should;
}

/**
 * Who won each claim. A stat tile or a solo count names its finisher on the completion itself; a
 * submission-backed one doesn't, so the newest submission credited on that (tile, team) is the next
 * best answer — the same order of preference the plugin's claim feed uses. Failing both, the team
 * name at least tells a treasurer who to pay, which is more useful than a blank row.
 */
async function resolveClaimants(
  eventId: number,
  claims: { id: number; tileId: number; teamId: number; creditPlayerId: number | null }[],
): Promise<Map<number, { clanMemberId: number | null; rsn: string | null }>> {
  const out = new Map<number, { clanMemberId: number | null; rsn: string | null }>();
  const participants = await db
    .select({ id: eventParticipants.id, name: eventParticipants.name, clanMemberId: eventParticipants.clanMemberId })
    .from(eventParticipants)
    .where(eq(eventParticipants.eventId, eventId));
  const byParticipant = new Map(participants.map((p) => [p.id, p]));

  const unattributed = claims.filter((c) => c.creditPlayerId == null);
  const fallback = new Map<string, number>(); // `${tileId}:${teamId}` → participant id
  if (unattributed.length > 0) {
    const rows = await db
      .select({
        tileId: submissions.tileId,
        teamId: submissions.teamId,
        creditPlayerId: submissions.creditPlayerId,
        playerId: submissions.playerId,
      })
      .from(submissions)
      .where(inArray(submissions.tileId, [...new Set(unattributed.map((c) => c.tileId))]))
      .orderBy(submissions.createdAt); // ascending → the last write per (tile, team) wins
    for (const r of rows) {
      const who = r.creditPlayerId ?? r.playerId;
      if (who != null) fallback.set(`${r.tileId}:${r.teamId}`, who);
    }
  }

  const teamNames = new Map<number, string>();
  const teamIds = [...new Set(claims.map((c) => c.teamId))];
  if (teamIds.length > 0) {
    const rows = await db.select({ id: teams.id, name: teams.name }).from(teams).where(inArray(teams.id, teamIds));
    for (const t of rows) teamNames.set(t.id, t.name);
  }

  for (const c of claims) {
    const pid = c.creditPlayerId ?? fallback.get(`${c.tileId}:${c.teamId}`) ?? null;
    const p = pid != null ? byParticipant.get(pid) : undefined;
    out.set(c.id, {
      clanMemberId: p?.clanMemberId ?? null,
      rsn: p?.name ?? teamNames.get(c.teamId) ?? null,
    });
  }
  return out;
}

/** Settle one event by id — the admin panel's "pay out what's owed" and the manual-drop path. */
export async function settleMissionAwardsForEvent(eventId: number): Promise<SettledAward[]> {
  // clan-scope: global -- takes an entity id whose caller has already settled the clan — the 'one hop, never a copy' rule in lib/eventScope. Every route and page that reaches this is verified scoped.
  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event) return [];
  return settleMissionAwards(event);
}

/** Prizes won on this event that a treasurer still has to send. Drives the "gp owed" nudge. */
export async function unpaidAwards(eventId: number): Promise<{ count: number; gp: number }> {
  // clan-scope: global -- keyed by an event id the caller has already settled.
  const rows = await db
    .select({ amount: cofferEntries.amount })
    .from(cofferEntries)
    .where(
      and(
        eq(cofferEntries.eventId, eventId),
        eq(cofferEntries.kind, 'award'),
        eq(cofferEntries.status, 'reserved'),
      ),
    );
  return { count: rows.length, gp: rows.reduce((sum, r) => sum + Math.abs(Number(r.amount)), 0) };
}
