import { NextResponse } from 'next/server';
import { db } from '@/db';
import { events, teams } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyUser } from '@/lib/auth';

// GET /api/captain/my-teams — for the currently signed-in (Discord) user, return every
// team they're assigned as captain of, with light event context for the picker UI.
export async function GET() {
  const user = await verifyUser();
  if (!user || user.userId <= 0) return NextResponse.json([]);

  const rows = await db
    .select({
      teamId: teams.id,
      teamName: teams.name,
      teamColor: teams.color,
      eventId: events.id,
      eventName: events.name,
      eventStartDate: events.startDate,
      eventEndDate: events.endDate,
      eventForceEndedAt: events.forceEndedAt,
    })
    .from(teams)
    .innerJoin(events, eq(teams.eventId, events.id))
    .where(eq(teams.captainUserId, user.userId));

  return NextResponse.json(rows);
}
