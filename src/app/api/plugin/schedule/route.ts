import { NextResponse } from 'next/server';
import { resolveClanFromRequest } from '@/lib/clanContext';
import { buildSchedule } from '@/lib/pluginConfig';

// GET /api/plugin/schedule — unauthenticated list of THIS clan's active + upcoming events.
// Consumed by older plugin builds' "Upcoming" side-panel section. Newer builds read the
// same data merged into GET /api/plugin/config; this endpoint stays for backward compat.
// Read-only, cheap. See src/lib/pluginConfig.ts for the shared builder.
//
// The clan is resolved from the request, not from a token — see the note on the sibling
// active-weekly route for why that is the same standing this endpoint always had. Before the filter
// existed, one anonymous call here returned every clan's schedule on the platform.
//
// An empty schedule when no clan is named, rather than a 404: the plugin's fetchSchedule() returns
// null on any non-2xx and the panel goes blank either way, so the difference is only whether the
// client logs a failure for a question the apex has no answer to.
export async function GET(request: Request) {
  const clan = await resolveClanFromRequest(request);
  if (!clan) return NextResponse.json({ bingos: [], weeklies: [] });
  return NextResponse.json(await buildSchedule(clan.id));
}
