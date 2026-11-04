import { NextResponse } from 'next/server';

import { db } from '@/db';
import { clanAuditLog } from '@/db/schema';
import { verifyUser } from '@/lib/auth';
import { atLeast } from '@/lib/clanRoles';
import { eventForRequest } from '@/lib/eventScope';
import { resolveClanById } from '@/lib/clanContext';
import { normalizeHex } from '@/lib/artPalette';
import { isHiddenHost } from '@/lib/friendEventsSql';
import { overlayKeyFor, removeOverlayKey, rotateOverlayKey } from '@/lib/overlay/overlayData';

// The host's side of an event's stream overlay (lib/overlay). Admin of the event's clan only: the
// key is a public capability once it is on a stream, so only the people who run the event mint it.
//
//   GET     → { key, accent }    the current key, or null when the event has no overlay link, and
//                                the host's picked colour (#rrggbb or null), the links' default accent
//   POST    → { key }            make one, or replace it ("Reset link" — old URLs stop working)
//   DELETE  → { key: null }      turn the overlay off

async function guard(request: Request, raw: string) {
  const session = await verifyUser();
  if (!session || !atLeast(session.role, 'admin')) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  const eventId = Number(raw);
  if (!Number.isInteger(eventId) || eventId <= 0) {
    return { error: NextResponse.json({ error: 'Invalid event id' }, { status: 400 }) };
  }
  // Ids are global and this one came from the URL: the event must be this clan's.
  const event = await eventForRequest(request, eventId);
  if (!event) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  // A friends event (lib/friendEventRules) is private: no stream overlay to mint.
  if (await isHiddenHost(event.clanId)) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  return { session, eventId, clanId: event.clanId };
}

export async function GET(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const g = await guard(request, (await params).eventId);
  if ('error' in g) return g.error;
  const [key, host] = await Promise.all([overlayKeyFor(g.eventId), resolveClanById(g.clanId)]);
  return NextResponse.json({ key, accent: normalizeHex(host?.accentColor ?? null) });
}

export async function POST(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const g = await guard(request, (await params).eventId);
  if ('error' in g) return g.error;
  const had = (await overlayKeyFor(g.eventId)) != null;
  const key = await rotateOverlayKey(g.eventId);
  await audit(g.clanId, g.session.userId, had ? 'overlay_link_reset' : 'overlay_link_created', g.eventId);
  return NextResponse.json({ key });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const g = await guard(request, (await params).eventId);
  if ('error' in g) return g.error;
  await removeOverlayKey(g.eventId);
  await audit(g.clanId, g.session.userId, 'overlay_link_removed', g.eventId);
  return NextResponse.json({ key: null });
}

async function audit(clanId: number, userId: number | undefined, eventType: string, eventId: number) {
  // clan-scope: this clan -- the event was scoped to the caller's clan by guard().
  await db
    .insert(clanAuditLog)
    .values({ clanId, eventType, actorUserId: userId ?? null, newValue: JSON.stringify({ eventId }) })
    .catch(() => {});
}
