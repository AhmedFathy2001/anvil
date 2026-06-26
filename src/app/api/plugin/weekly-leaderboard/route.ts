import { NextResponse } from 'next/server';
import { db } from '@/db';
import { weeklyCompetitions } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { computeLeaderboard, getEffectiveParticipants } from '@/lib/weekly';

// GET /api/plugin/weekly-leaderboard[?id=<competitionId>]
// Returns the ranked standings for a weekly competition (the active one when no id is given),
// for the RuneLite plugin's Anvil tab. Unauthenticated — leaderboards are public. Read-only.
// Capped at the top 50 to keep the payload small; the plugin highlights the local player by RSN.
const MAX_ENTRIES = 50;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const idParam = searchParams.get('id');

  const comp = idParam
    ? await db.query.weeklyCompetitions.findFirst({
        where: eq(weeklyCompetitions.id, parseInt(idParam, 10)),
      })
    : await db.query.weeklyCompetitions.findFirst({
        where: eq(weeklyCompetitions.status, 'active'),
      });

  if (!comp) {
    return NextResponse.json({ competition: null, total: 0, entries: [] });
  }

  // Excludes anyone whose clan_member has left the CC (unless an admin set keepIfLeft) so the
  // headcount + standings reflect current members. See getEffectiveParticipants.
  const participants = await getEffectiveParticipants(comp.id);

  // Dedupe by RSN (case-insensitive): a rename/re-enroll can leave two participant rows for the
  // same player, which otherwise shows them twice. Keep the row with the most progress.
  // Normalize whitespace too - OSRS display names can carry non-breaking spaces, so
  // "Drenvox mdps" can arrive with mismatched spacing and dodge a plain lowercase compare.
  const byRsn = new Map<string, (typeof participants)[number]>();
  for (const p of participants) {
    const key = (p.rsn ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
    const existing = byRsn.get(key);
    if (!existing || (p.currentValue ?? 0) > (existing.currentValue ?? 0)) {
      byRsn.set(key, p);
    }
  }

  const board = computeLeaderboard([...byRsn.values()]);
  const entries = board.slice(0, MAX_ENTRIES).map((e, i) => ({
    rank: i + 1,
    rsn: e.rsn,
    // Clamp to >= 0: a not-yet-fetched / unranked participant has currentValue null, which
    // computeLeaderboard treats as 0, yielding a spurious negative gain (0 - baseline). You
    // can't lose KC/XP, so floor it at 0.
    gained: Math.max(0, e.gained),
  }));

  return NextResponse.json({
    competition: {
      id: comp.id,
      title: comp.title,
      type: comp.type,
      metric: comp.metric,
      startDate: comp.startDate,
      endDate: comp.endDate,
    },
    total: board.length,
    entries,
  });
}
