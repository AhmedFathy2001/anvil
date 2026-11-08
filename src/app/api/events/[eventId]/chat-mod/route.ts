import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { teams } from '@/db/schema';
import { verifyUser } from '@/lib/auth';
import { requireClan } from '@/lib/clanContext';
import {
  chatAccess,
  chatModLines,
  chatSanctions,
  deleteChat,
  liftChatSanction,
  pauseChat,
  sanctionChat,
  sanctionableUsers,
  type ChatAccess,
} from '@/lib/eventChat';
import { cleanReason, timeoutMinutes } from '@/lib/eventChatRules';
import { eventInClan } from '@/lib/eventScope';
import { rateLimit } from '@/lib/rate-limit';

// The event chat's moderation page (app/events/[eventId]/chat): recent lines with Delete, timeouts,
// bans, Lift, and pause. The same model as the plugin's right-click actions (lib/eventChat), so a
// ban from either shows on both.
//
// WHO: the host clan's moderators and up, or Anvil platform staff (chatAccess `staff`), read live
// from the database on every request. WHOSE EVENT: the one this address's clan hosts (eventInClan) —
// never a co-host's address, where a clan role would be the co-host's, not the host's.
//
// GET  ?f=all|team|staff&team=<id>&q=<text>  → { chat, lines, teams, sanctions }
// POST { action: 'delete', id } | { action: 'timeout', userId, minutes | preset, reason? }
//      | { action: 'ban', userId, reason? } | { action: 'lift', userId } | { action: 'pause', paused }

async function scope(raw: string): Promise<{ access: ChatAccess; userId: number } | NextResponse> {
  const eventId = Number(raw);
  const session = await verifyUser();
  if (!session) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  const clan = await requireClan();
  if (!Number.isInteger(eventId) || !(await eventInClan(clan.id, eventId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const access = await chatAccess(eventId, session.userId);
  if (!access?.staff) return NextResponse.json({ error: 'Only this event’s mods and admins can moderate its chat' }, { status: 403 });
  return { access, userId: session.userId };
}

export async function GET(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const s = await scope((await params).eventId);
  if (s instanceof NextResponse) return s;
  const { access, userId } = s;
  const url = new URL(request.url);
  const f = url.searchParams.get('f');
  const filter = f === 'team' || f === 'staff' ? f : 'all';
  const teamId = Number(url.searchParams.get('team')) || null;
  const [lines, teamRows, sanctions] = await Promise.all([
    chatModLines(access.eventId, { filter, teamId, q: url.searchParams.get('q') ?? '' }),
    db.select({ id: teams.id, name: teams.name, color: teams.color }).from(teams).where(eq(teams.eventId, access.eventId)).orderBy(teams.name),
    chatSanctions(access, userId),
  ]);
  const actOn = await sanctionableUsers(access, userId, lines.map((l) => l.userId));
  return NextResponse.json({
    chat: { open: access.open, closedWhy: access.closedWhy, paused: access.paused },
    teams: teamRows,
    lines: lines.map((l) => ({ ...l, canSanction: actOn.has(l.userId) })),
    sanctions,
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const s = await scope((await params).eventId);
  if (s instanceof NextResponse) return s;
  const { access, userId } = s;
  const rl = await rateLimit(request, `event-chat-mod:${userId}`, { limit: 60, windowMs: 60_000 });
  if (!rl.ok) return NextResponse.json({ error: 'Slow down a little.' }, { status: 429 });
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const action = body?.action;
  const target = Number(body?.userId);
  let r;
  if (action === 'delete') {
    r = await deleteChat(access, userId, Number(body?.id));
  } else if (action === 'timeout') {
    const minutes = timeoutMinutes(body?.minutes ?? body?.preset);
    if (minutes == null) return NextResponse.json({ error: 'Pick 5 minutes, 1 hour, 24 hours, or a number of minutes up to 30 days.' }, { status: 400 });
    r = await sanctionChat(access, userId, target, { kind: 'timeout', minutes, reason: cleanReason(body?.reason) });
  } else if (action === 'ban') {
    r = await sanctionChat(access, userId, target, { kind: 'ban', reason: cleanReason(body?.reason) });
  } else if (action === 'lift') {
    r = await liftChatSanction(access, userId, target);
  } else if (action === 'pause' && typeof body?.paused === 'boolean') {
    r = await pauseChat(access, body.paused, userId);
  } else {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
