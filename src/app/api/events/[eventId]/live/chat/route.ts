import { NextResponse } from 'next/server';

import { liveChat, liveChatAct } from '@/lib/liveData';

import { liveScope } from '../scope';

// The Feed & chat page's chat (app/events/[eventId]/live): the plugin's chat pane, for the website.
//
// GET  ?f=team|all|announce&tm=<team>&rd=<channel left>&seat=<participant>
//      → the open channel's lines (newest first), the switch with unread counts, staff's team chips,
//        "Only my team's chat", the box's lock and pace line. The open channel counts as read.
// POST { action: 'send', msg, to } | { action: 'delete', id } | { action: 'mute', id }
//      | { action: 'own-team', on } | { action: 'pause', on }   (?seat= as above)
//      The plugin's own chat actions (lib/pluginUi/feedView runChatAct), with its rate limit: a line
//      sent here reaches every open RuneLite panel exactly as one sent from the plugin does.

export async function GET(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const url = new URL(request.url);
  const s = await liveScope((await params).eventId, url.searchParams.get('seat'));
  if (s instanceof NextResponse) return s;
  const q = (k: string) => url.searchParams.get(k) ?? undefined;
  const state = await liveChat(s.access, s.userId, { f: q('f'), tm: q('tm'), rd: q('rd') });
  return NextResponse.json(state, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const url = new URL(request.url);
  const s = await liveScope((await params).eventId, url.searchParams.get('seat'));
  if (s instanceof NextResponse) return s;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const r = await liveChatAct(request, s.access, s.userId, body);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true });
}
