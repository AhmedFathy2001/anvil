import { NextResponse } from 'next/server';
import { db } from '@/db';
import { events } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyUser } from '@/lib/auth';
import { isEventEnded } from '@/lib/survey';
import { getEventRecap } from '@/lib/eventRecap';

// The fun end-of-event superlatives ("Warmonger", "Big Baller", …), derived on read. Public once the
// event has ended; staff (admin/treasurer/moderator) can preview it earlier to see what players will
// get. Before the event ends, non-staff get an empty, `ended:false` payload (the page shows a nudge).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await params;
  const id = parseInt(eventId, 10);
  if (Number.isNaN(id)) return NextResponse.json({ error: 'Bad event id' }, { status: 400 });

  const event = await db.query.events.findFirst({ where: eq(events.id, id) });
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const ended = isEventEnded(event);
  const session = await verifyUser();
  const isStaff = session?.role === 'admin' || session?.role === 'treasurer' || session?.role === 'moderator';

  if (!ended && !isStaff) {
    return NextResponse.json({ eventId: id, eventName: event.name, ended: false, awards: [], totals: null, preview: false });
  }

  const recap = await getEventRecap(id);
  if (!recap) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // preview = staff looking at it before the event has actually closed.
  return NextResponse.json({ ...recap, preview: !ended });
}
