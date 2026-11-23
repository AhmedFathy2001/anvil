// The one guard every event settings route calls first: a PRACTICE board (lib/practice) has none of
// the real event's machinery — co-hosts, sign-ups, forms, drafts, captains, teams, fees, prizes,
// payouts, Discord channels and hooks, announcements, rulebook, theme, overlay, invites, editors —
// and its own page manages everything it does have (api/admin/practice/*, plus the tile import
// "Add tiles" uses). The admin pages for an event already redirect a practice board away; this is
// the same answer for anyone calling the routes directly.

import { NextResponse } from 'next/server';

import { isPracticeEvent } from '@/lib/practiceScope';

type EventParams = { eventId?: string | number } | Promise<{ eventId?: string | number }>;

/** The 404 to send when this route's event is a practice board, or null to carry on. */
export async function refusePractice(params: EventParams | null | undefined): Promise<NextResponse | null> {
  if (!params) return null;
  const { eventId } = await params;
  const id = typeof eventId === 'number' ? eventId : parseInt(String(eventId ?? ''), 10);
  if (!Number.isInteger(id) || id <= 0) return null;
  if (!(await isPracticeEvent(id))) return null;
  return NextResponse.json({ error: 'Not available on a practice board.' }, { status: 404 });
}
