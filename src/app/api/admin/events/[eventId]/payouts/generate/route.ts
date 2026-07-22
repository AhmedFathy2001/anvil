import { NextResponse } from 'next/server';
import { db } from '@/db';
import { events, payouts, players } from '@/db/schema';
import { and, eq, inArray, isNotNull, isNull } from 'drizzle-orm';
import { verifyFeeCollector } from '@/lib/auth';
import { getTeamStandings } from '@/lib/statStandings';
import { buildPayoutPlan, suggestPlaceAmounts, getEventPrizePool, type PlanTeam } from '@/lib/payouts';

// POST — (re)generate per-player payout rows from the final standings.
// Body: { paidPlaces?: number, placeAmounts?: number[] (gp reward per placement), totalPool?: number }.
// `placeAmounts` (explicit per-placement rewards) is authoritative when provided; otherwise the
// reward per place is calculated from the pool via the default split. Existing PAID rows are never
// touched; pending auto-rows are refreshed; stale pending auto-rows (a team that dropped out of the
// paid places on regenerate) are removed. Manual rows are preserved.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  if (!(await verifyFeeCollector())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { eventId } = await params;
  const id = parseInt(eventId, 10);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'Invalid event id' }, { status: 400 });
  }

  const event = await db.query.events.findFirst({ where: eq(events.id, id) });
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

  const body = (await request.json().catch(() => null)) as {
    paidPlaces?: number;
    placeAmounts?: number[];
    totalPool?: number;
    includeSubbed?: boolean;
  } | null;
  // Subbed-out (benched/frozen) players are excluded from the split by default — they didn't finish
  // the event on the team, so their share redistributes to the active members. Opt in to include them.
  const includeSubbed = body?.includeSubbed === true;

  const standings = await getTeamStandings(id, event.scoringMode);
  const explicitAmounts =
    Array.isArray(body?.placeAmounts) && body.placeAmounts.every((n) => typeof n === 'number' && Number.isFinite(n))
      ? body.placeAmounts.map((n) => Math.max(0, Math.round(n)))
      : null;

  // Number of paid places: explicit request wins, else the length of the amounts array, else 1.
  // Clamped to the number of teams that actually exist.
  const requestedPlaces = Number(body?.paidPlaces) || explicitAmounts?.length || 1;
  const paidPlaces = Math.min(Math.max(1, Math.round(requestedPlaces)), standings.length || 1);
  const topTeams = standings.slice(0, paidPlaces);

  const pool = await getEventPrizePool(id);
  // Reward per placement: explicit per-place amounts are authoritative; otherwise calculate them from
  // the pool (a totalPool override, or the real pool) via the default split.
  const totalPool =
    typeof body?.totalPool === 'number' && Number.isFinite(body.totalPool) && body.totalPool >= 0
      ? Math.round(body.totalPool)
      : pool.total;
  const placeAmounts = explicitAmounts ?? suggestPlaceAmounts(totalPool, paidPlaces);

  // Members (players with a linked account) for each paid team, in roster order. Frozen/subbed-out
  // players are filtered out unless includeSubbed is set.
  const teamIds = topTeams.map((t) => t.teamId);
  const memberFilters = [
    eq(players.eventId, id),
    inArray(players.teamId, teamIds),
    isNotNull(players.clanMemberId),
    ...(includeSubbed ? [] : [isNull(players.frozenAt)]),
  ];
  const teamPlayers = teamIds.length ? await db.select().from(players).where(and(...memberFilters)) : [];
  const membersByTeam = new Map<number, { clanMemberId: number; rsn: string }[]>();
  for (const p of teamPlayers) {
    if (p.clanMemberId == null) continue;
    const list = membersByTeam.get(p.teamId!) ?? [];
    list.push({ clanMemberId: p.clanMemberId, rsn: p.name });
    membersByTeam.set(p.teamId!, list);
  }

  const places: PlanTeam[] = topTeams.map((t) => ({
    teamId: t.teamId,
    teamName: t.name,
    members: membersByTeam.get(t.teamId) ?? [],
  }));

  const plan = buildPayoutPlan({ places, placeAmounts });
  const planMemberIds = new Set(plan.map((r) => r.clanMemberId));

  const existing = await db.select().from(payouts).where(eq(payouts.eventId, id));
  const existingByMember = new Map(
    existing.filter((r) => r.clanMemberId != null).map((r) => [r.clanMemberId as number, r]),
  );

  // Remove stale PENDING auto-generated rows (place != null) whose member is no longer a winner.
  // Paid rows and manual rows (place == null) are left alone.
  for (const r of existing) {
    if (
      r.status === 'pending' &&
      r.place != null &&
      r.clanMemberId != null &&
      !planMemberIds.has(r.clanMemberId)
    ) {
      await db.delete(payouts).where(eq(payouts.id, r.id));
    }
  }

  for (const row of plan) {
    const current = existingByMember.get(row.clanMemberId);
    if (current) {
      if (current.status === 'paid') continue; // don't overwrite a completed payment
      await db
        .update(payouts)
        .set({ rsn: row.rsn, teamId: row.teamId, teamName: row.teamName, place: row.place, amount: row.amount })
        .where(eq(payouts.id, current.id));
    } else {
      await db
        .insert(payouts)
        .values({
          eventId: id,
          clanMemberId: row.clanMemberId,
          rsn: row.rsn,
          teamId: row.teamId,
          teamName: row.teamName,
          place: row.place,
          amount: row.amount,
          status: 'pending',
        })
        .onConflictDoNothing();
    }
  }

  const rows = await db.select().from(payouts).where(eq(payouts.eventId, id));
  return NextResponse.json({
    payouts: rows.sort((a, b) => (a.place ?? 99) - (b.place ?? 99) || b.amount - a.amount),
    paidPlaces,
    placeAmounts,
  });
}
