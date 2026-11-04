import { NextResponse } from 'next/server';

import { verifyUser } from '@/lib/auth';
import { atLeast } from '@/lib/clanRoles';
import { eventForRequest } from '@/lib/eventScope';
import { rotateInviteToken } from '@/lib/friendEvents';
import { friendsInvitePath } from '@/lib/friendEventRules';

/**
 * A friends event's invite link (lib/friendEvents): POST makes a new one, and the old link stops
 * working. Somebody already in stays in — the link only lets new people in.
 */
export async function POST(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const session = await verifyUser();
  if (!session || !atLeast(session.role, 'admin')) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }
  const eventId = Number((await params).eventId);
  const event = await eventForRequest(request, eventId);
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const token = await rotateInviteToken(event.id);
  if (!token) return NextResponse.json({ error: 'Only a friends event has an invite link.' }, { status: 400 });
  return NextResponse.json({ ok: true, token, invitePath: friendsInvitePath(token) });
}
