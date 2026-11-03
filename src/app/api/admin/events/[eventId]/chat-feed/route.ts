import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { events } from '@/db/schema';
import { verifyAdmin } from '@/lib/auth';
import { requireClan } from '@/lib/clanContext';
import { eventInClan } from '@/lib/eventScope';
import { standingsHidden } from '@/lib/standingsVisibility';

// The board's in-game chat feed switch (lib/chatFeed): every team's notable drops and tile completions
// in every participant's RuneLite chat. Host admins only — it shows each team what the others are
// getting, which is the host's call.

async function scope(raw: string) {
  const eventId = Number(raw);
  if (!Number.isInteger(eventId)) return null;
  if (!(await verifyAdmin())) return 'forbidden' as const;
  const clan = await requireClan();
  const event = await eventInClan(clan.id, eventId);
  return event ? { eventId } : null;
}

async function view(eventId: number) {
  // clan-scope: this clan -- scope() checked the event is this clan's (eventInClan) before any read.
  const row = await db.query.events.findFirst({
    where: eq(events.id, eventId),
    columns: { chatFeed: true, rules: true, endDate: true, forceEndedAt: true },
  });
  return { chatFeed: !!row?.chatFeed, standingsHidden: row ? standingsHidden(row) : false };
}

export async function GET(_req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const s = await scope((await params).eventId);
  if (s === 'forbidden') return NextResponse.json({ error: 'Admins only' }, { status: 403 });
  if (!s) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(await view(s.eventId));
}

export async function PUT(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const s = await scope((await params).eventId);
  if (s === 'forbidden') return NextResponse.json({ error: 'Admins only' }, { status: 403 });
  if (!s) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const body = await request.json().catch(() => null);
  if (typeof body?.chatFeed !== 'boolean') return NextResponse.json({ error: 'Expected { chatFeed: boolean }' }, { status: 400 });
  // clan-scope: this clan -- scope() checked the event is this clan's (eventInClan).
  await db.update(events).set({ chatFeed: body.chatFeed }).where(eq(events.id, s.eventId));
  return NextResponse.json(await view(s.eventId));
}
