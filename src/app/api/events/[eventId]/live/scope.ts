import { NextResponse } from 'next/server';

import { verifyUser } from '@/lib/auth';
import { requireClan } from '@/lib/clanContext';
import type { ChatAccess } from '@/lib/eventChat';
import { eventInClan } from '@/lib/eventScope';
import { liveAccess } from '@/lib/liveData';
import { LIVE_NO_ACCESS } from '@/lib/liveView';

// Who is asking, for the Feed & chat page's API (api/events/[id]/live/*).
//
// WHO: the website's Discord session (verifyUser), read live, then chatAccess: the board's seated
// players and the host's staff (and Anvil staff), nobody else. `?seat=` picks which of the viewer's
// own seats speaks when they hold two (lib/liveData liveAccess).
// WHOSE EVENT: the one this address's clan hosts (eventInClan). A co-host's page registers the
// host's address for its event calls (components/EventApiHost), so these always answer there.

export async function liveScope(rawEventId: string, seatRaw: unknown): Promise<{ access: ChatAccess; userId: number } | NextResponse> {
  const eventId = Number(rawEventId);
  const session = await verifyUser();
  if (!session) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  const clan = await requireClan();
  if (!Number.isInteger(eventId) || !(await eventInClan(clan.id, eventId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const { access } = await liveAccess(eventId, session.userId, seatRaw);
  if (!access?.member) return NextResponse.json({ error: LIVE_NO_ACCESS }, { status: 403 });
  return { access, userId: session.userId };
}
