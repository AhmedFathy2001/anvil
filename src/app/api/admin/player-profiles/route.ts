import { NextResponse } from 'next/server';
import { verifyAdminOrModerator } from '@/lib/auth';
import { computePlayerProfiles } from '@/lib/playerProfile';

// Staff-only player-profile ratings (balance-engine plan). ?eventId=N rates that event's roster /
// sign-up pool (the draft + pre-start view); without it, the whole active clan is rated. Ratings
// are sensitive by design — staff and draft captains only, never public; players may later see
// their OWN profile through a separate surface.
export async function GET(request: Request) {
  const staff = await verifyAdminOrModerator();
  if (!staff) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const eventIdRaw = url.searchParams.get('eventId');
  const eventId = eventIdRaw != null ? parseInt(eventIdRaw, 10) : undefined;
  if (eventIdRaw != null && !Number.isFinite(eventId)) {
    return NextResponse.json({ error: 'eventId must be a number' }, { status: 400 });
  }

  const profiles = await computePlayerProfiles({ eventId });
  return NextResponse.json({
    eventId: eventId ?? null,
    count: profiles.length,
    withHistory: profiles.filter((p) => p.evidenceEvents > 0).length,
    withActivity: profiles.filter((p) => p.activityKc != null || p.activityXp != null).length,
    profiles,
  });
}
