import { NextResponse } from 'next/server';

import { verifyUser } from '@/lib/auth';
import { atLeast } from '@/lib/clanRoles';
import { eventForRequest } from '@/lib/eventScope';
import { panelImage } from '@/lib/overlay/panelImage';
import { isPanelKind, panelFileName } from '@/lib/overlay/streamPanels';

export const dynamic = 'force-dynamic';

// A channel panel image for this event (lib/overlay/streamPanels). Admin of the event's clan only,
// like the overlay link: it is made to be downloaded and uploaded to Twitch/Kick by the host, and an
// invite-only event's name is not something to render for anyone who guesses an id.
//
//   GET ?download=1 → the same PNG as an attachment, named after the event.

export async function GET(request: Request, { params }: { params: Promise<{ eventId: string; kind: string }> }) {
  const { eventId: raw, kind } = await params;
  const session = await verifyUser();
  if (!session || !atLeast(session.role, 'admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const eventId = Number(raw);
  if (!Number.isInteger(eventId) || eventId <= 0 || !isPanelKind(kind)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  // Ids are global and this one came from the URL: the event must be this clan's.
  const event = await eventForRequest(request, eventId);
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const download = new URL(request.url).searchParams.get('download') === '1';
  const headers: Record<string, string> = { 'Cache-Control': 'private, no-store' };
  if (download) headers['Content-Disposition'] = `attachment; filename="${panelFileName(event.name, eventId, kind)}"`;

  return panelImage(kind, event.name, headers);
}
