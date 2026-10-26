import { NextResponse } from 'next/server';

import { pageParams } from '@/lib/eventRoster';
import { jsonWithEtag } from '@/lib/httpEtag';
import { pluginRoster } from '@/lib/pluginRoster';

// GET /api/plugin/event/[id]/roster — the plugin's Teams page, a page at a time (lib/eventRoster).
//
//   (nothing)   the teams ranked, or the players ranked when every team is one person
//   ?team=<id>  one team's members
//   ?q=<name>   players by name across every team
//   &page=<n>&size=<n>  1-based; size defaults to 25, at most 50
//
// The board endpoint stays as it is: it is polled, and a 1,200-name roster has no business riding
// along on every poll. This one is fetched when somebody opens the page, and answers 304 when
// nothing moved.
//
// Who may read it: lib/pluginRoster.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const eventId = Number(rawId);
  if (!Number.isInteger(eventId) || eventId <= 0) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }
  const url = new URL(request.url);
  const { page, pageSize } = pageParams(url.searchParams.get('page'), url.searchParams.get('size'));
  const teamParam = url.searchParams.get('team');
  if (teamParam != null && !/^[1-9]\d{0,9}$/.test(teamParam)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const out = await pluginRoster(request, eventId, {
    query: url.searchParams.get('q') ?? '',
    team: teamParam == null ? null : Number(teamParam),
    page,
    pageSize,
  });
  // The same answer for "no such event" and "not yours to see": the 404 must not probe for ids.
  return out ? jsonWithEtag(request, out) : NextResponse.json({ error: 'Not found' }, { status: 404 });
}
