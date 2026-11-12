import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { clans, events } from '@/db/schema';
import { verifyUser } from '@/lib/auth';
import { atLeast } from '@/lib/clanRoles';
import { forgetChatTag, platformChatOn, setEventChat, setEventChatPaused } from '@/lib/eventChat';
import { chatTagOf, cleanChatTag, CHAT_TAG_MAX } from '@/lib/eventChatRules';
import { mergeEventRulesPatch, parseEventRules, validateEventRules } from '@/lib/eventRules';
import { requireClan } from '@/lib/clanContext';
import { eventInClan } from '@/lib/eventScope';
import { standingsHidden } from '@/lib/standingsVisibility';

// The board's in-game chat feed switch (lib/chatFeed): every team's notable drops and tile completions
// in every participant's RuneLite chat. Host admins only — it shows each team what the others are
// getting, which is the host's call. The same card holds the event chat's switches (lib/eventChat):
// on/off for the board's private chat in the plugin's Feed tab, and pause.

async function scope(raw: string) {
  const eventId = Number(raw);
  if (!Number.isInteger(eventId)) return null;
  const session = await verifyUser();
  if (!session || !atLeast(session.role, 'admin')) return 'forbidden' as const;
  const clan = await requireClan();
  const event = await eventInClan(clan.id, eventId);
  return event ? { eventId, clanId: clan.id, userId: session.userId } : null;
}

async function view(eventId: number) {
  // clan-scope: this clan -- scope() checked the event is this clan's (eventInClan) before any read.
  const row = await db.query.events.findFirst({
    where: eq(events.id, eventId),
    columns: { chatFeed: true, chatEnabled: true, chatPaused: true, rules: true, endDate: true, forceEndedAt: true, name: true, clanId: true },
  });
  // clan-scope: this clan -- the event's own host, for the tag derived from its name
  const clan = row ? await db.query.clans.findFirst({ where: eq(clans.id, row.clanId), columns: { name: true } }) : null;
  const stored = parseEventRules(row?.rules).chatTag;
  return {
    // The chatbox tag (lib/eventChatRules): the host's own, or what the name gives.
    chatTag: stored,
    chatTagDerived: row ? chatTagOf(null, row.name, clan?.name) : '',
    chatTagMax: CHAT_TAG_MAX,
    chatFeed: !!row?.chatFeed,
    chatEnabled: !!row?.chatEnabled,
    chatPaused: !!row?.chatPaused,
    chatPlatformOn: await platformChatOn(),
    standingsHidden: row ? standingsHidden(row) : false,
  };
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
  const keys = ['chatFeed', 'chatEnabled', 'chatPaused'] as const;
  const tagGiven = body && 'chatTag' in body && (typeof body.chatTag === 'string' || body.chatTag === null);
  if (!body || (!keys.some((k) => typeof body[k] === 'boolean') && !tagGiven)) {
    return NextResponse.json({ error: 'Expected { chatFeed | chatEnabled | chatPaused: boolean } or { chatTag: string | null }' }, { status: 400 });
  }
  if (tagGiven) {
    // clan-scope: this clan -- scope() checked the event is this clan's (eventInClan).
    const row = await db.query.events.findFirst({ where: eq(events.id, s.eventId), columns: { rules: true } });
    const checked = validateEventRules(mergeEventRulesPatch(row?.rules, { chatTag: cleanChatTag(body.chatTag) }));
    if ('error' in checked) return NextResponse.json({ error: checked.error }, { status: 400 });
    // clan-scope: this clan -- scope() checked the event is this clan's (eventInClan).
    await db.update(events).set({ rules: checked.rules }).where(eq(events.id, s.eventId));
    forgetChatTag(s.eventId);
  }
  // clan-scope: this clan -- scope() checked the event is this clan's (eventInClan).
  if (typeof body.chatFeed === 'boolean') await db.update(events).set({ chatFeed: body.chatFeed }).where(eq(events.id, s.eventId));
  if (typeof body.chatEnabled === 'boolean') await setEventChat(s.eventId, body.chatEnabled);
  if (typeof body.chatPaused === 'boolean') await setEventChatPaused(s.eventId, body.chatPaused, { clanId: s.clanId, byUserId: s.userId });
  return NextResponse.json(await view(s.eventId));
}
