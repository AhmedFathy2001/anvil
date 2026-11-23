// The one guard every event settings route calls first: a PRACTICE board (lib/practice) has none of
// the real event's machinery — co-hosts, sign-ups, forms, drafts, captains, teams, fees, prizes,
// payouts, Discord channels and hooks, announcements, rulebook, theme, overlay, invites, editors —
// and its own page manages everything it does have (api/admin/practice/*, plus the tile import
// "Add tiles" uses). The admin pages for an event already redirect a practice board away; this is
// the same answer for anyone calling the routes directly.
//
// FAIL CLOSED, ONE PARSER. The guard and the route behind it must agree on which event an id names,
// or "12abc" passes the guard as "not an id" and reaches a handler whose parseInt reads it as 12. So
// an id is exactly 1–9 digits or it is refused here, and every id this lets through reads the same
// under parseInt, Number and the routes' own parsers.

import { NextResponse } from 'next/server';

import { isPracticeEvent } from '@/lib/practiceScope';

type EventParams = { eventId?: string | number } | Promise<{ eventId?: string | number }>;

/** The event id in a route's params, strictly: 1–9 digits, else null. */
export function strictEventId(raw: unknown): number | null {
  const text = typeof raw === 'number' ? String(raw) : raw;
  if (typeof text !== 'string' || !/^\d{1,9}$/.test(text)) return null;
  const id = Number(text);
  return id > 0 ? id : null;
}

const notFound = (error: string) => NextResponse.json({ error }, { status: 404 });

/**
 * The 404 to send when this route's event is a practice board — or its id is not a plain number at
 * all — or null to carry on.
 */
export async function refusePractice(params: EventParams | null | undefined): Promise<NextResponse | null> {
  const { eventId } = (await params) ?? {};
  const id = strictEventId(eventId);
  if (id == null) return notFound('Not found');
  if (await isPracticeEvent(id)) return notFound('Not available on a practice board.');
  return null;
}
