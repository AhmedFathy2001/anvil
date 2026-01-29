import { NextResponse } from 'next/server';
import { db } from '@/db';
import { players, events, teams } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyAdmin } from '@/lib/auth';

export async function GET() {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get all players with their event and team info
  const allPlayers = await db.select().from(players);
  const allEvents = await db.select().from(events);
  const allTeams = await db.select().from(teams);

  const eventMap = new Map(allEvents.map(e => [e.id, e]));
  const teamMap = new Map(allTeams.map(t => [t.id, t]));

  const enrichedPlayers = allPlayers.map(p => ({
    ...p,
    eventName: eventMap.get(p.eventId)?.name || 'Unknown',
    teamName: p.teamId ? teamMap.get(p.teamId)?.name || null : null,
    teamColor: p.teamId ? teamMap.get(p.teamId)?.color || null : null,
  }));

  return NextResponse.json(enrichedPlayers);
}
