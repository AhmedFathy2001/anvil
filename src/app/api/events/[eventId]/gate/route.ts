import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';

import { db } from '@/db';
import { clanAuditLog, clans, events } from '@/db/schema';
import { verifyUser } from '@/lib/auth';
import { atLeast } from '@/lib/clanRoles';
import { eventForRequest } from '@/lib/eventScope';
import { isCreatorSpace, streamsEvents } from '@/lib/creatorSpaces';
import { parseGates, serializeGates, validateGatesFor } from '@/lib/entryGates';
import { gateOptions } from '@/lib/entryGatesDb';

/**
 * "Who can join?" for one event of a streaming space (lib/entryGates): Anyone, or any of the host's
 * Twitch followers / subscribers, a role in their Discord server, its boosters.
 *
 * On a creator space every event is for viewers. On a clan with Streaming on there is one more
 * choice in front: "Members only" (`openToViewers` false — the default, and how every clan event
 * works) or viewers too, past those gates, as event players (lib/eventPlayers).
 *
 * Admin of the hosting space only, and only on a streaming space — eventForRequest ties the event to
 * the space whose site this is, since event ids are global.
 */
async function guard(request: Request, params: Promise<{ eventId: string }>) {
  const session = await verifyUser();
  if (!session || !atLeast(session.role, 'admin')) {
    return { error: NextResponse.json({ error: 'Admin only' }, { status: 403 }) };
  }
  const eventId = Number((await params).eventId);
  if (!Number.isInteger(eventId) || eventId <= 0) return { error: NextResponse.json({ error: 'Bad event' }, { status: 400 }) };
  const event = await eventForRequest(request, eventId);
  if (!event) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  const host = await db.query.clans.findFirst({ where: eq(clans.id, event.clanId), columns: { kind: true, streaming: true } });
  if (!streamsEvents(host)) return { error: NextResponse.json({ error: 'Turn on Streaming first' }, { status: 404 }) };
  return { session, event, creator: isCreatorSpace(host) };
}

export async function GET(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const g = await guard(request, params);
  if ('error' in g) return g.error;
  return NextResponse.json({
    gates: parseGates(g.event.entryGates),
    options: await gateOptions(g.event.clanId),
    // A clan's extra choice; a creator space's events are always for viewers.
    membersChoice: !g.creator,
    openToViewers: g.creator ? true : g.event.openToViewers === true,
  });
}

export async function PUT(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const g = await guard(request, params);
  if ('error' in g) return g.error;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Bad body' }, { status: 400 });

  // Sanitized whatever was sent: unknown kinds, bad ids and extra fields are dropped by parseGates.
  const gates = parseGates((body as { gates?: unknown }).gates ?? null);
  const options = await gateOptions(g.event.clanId);
  const ok = validateGatesFor(gates, options);
  if (!ok.ok) return NextResponse.json({ error: ok.error }, { status: 400 });

  // Role names are taken from the server, not from the request, so the label viewers see is real.
  if (gates) {
    for (const r of gates.anyOf) {
      if (r.kind === 'discord-role') r.roleName = options.discord.roles.find((x) => x.id === r.roleId)?.name ?? r.roleName;
    }
  }
  const value = serializeGates(gates);
  // "Members only" or viewers too — a clan's choice; a strict boolean, anything else leaves it alone.
  const raw = (body as { openToViewers?: unknown }).openToViewers;
  const openToViewers = g.creator ? undefined : typeof raw === 'boolean' ? raw : undefined;
  await db
    .update(events)
    .set({ entryGates: value, ...(openToViewers !== undefined ? { openToViewers } : {}) })
    .where(and(eq(events.id, g.event.id), eq(events.clanId, g.event.clanId)));

  await db
    .insert(clanAuditLog)
    .values({
      clanId: g.event.clanId,
      eventType: 'event_entry_gates_changed',
      actorUserId: g.session.userId,
      newValue: JSON.stringify({ eventId: g.event.id, gates: value ? JSON.parse(value) : null, ...(openToViewers !== undefined ? { openToViewers } : {}) }),
    })
    .catch(() => {});

  return NextResponse.json({
    ok: true,
    gates: parseGates(value),
    openToViewers: g.creator ? true : (openToViewers ?? g.event.openToViewers === true),
  });
}
