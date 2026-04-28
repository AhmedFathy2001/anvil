import { NextResponse } from 'next/server';
import { db } from '@/db';
import { weeklyCompetitions } from '@/db/schema';
import { eq } from 'drizzle-orm';

// GET — returns the currently active weekly competition (if any). Used by the plugin
// to decide whether to auto-enroll the signed-in player on login. Read-only, cheap.
export async function GET() {

  const active = await db.query.weeklyCompetitions.findFirst({
    where: eq(weeklyCompetitions.status, 'active'),
  });

  if (!active) return NextResponse.json(null);

  return NextResponse.json({
    id: active.id,
    title: active.title,
    type: active.type,
    metric: active.metric,
    startDate: active.startDate,
    endDate: active.endDate,
  });
}
