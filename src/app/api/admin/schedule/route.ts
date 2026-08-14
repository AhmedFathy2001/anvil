import { NextResponse } from 'next/server';
import { verifyUser } from '@/lib/auth';
import { listEventIndex } from '@/lib/eventIndex';

// GET — everything this clan runs, boards and weeklies together, for the admin schedule calendar.
// One shape for both (lib/eventIndex) rather than two lists the client has to reconcile; the
// weekly links land on their admin workspace, not the player page. Any admin/moderator may view.
export async function GET() {
  const user = await verifyUser();
  if (!user || (user.role !== 'admin' && user.role !== 'moderator')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const items = await listEventIndex();
  // The calendar plots date ranges, so anything without both ends can't be placed on it.
  return NextResponse.json({ items: items.filter((i) => i.startDate && i.endDate) });
}
