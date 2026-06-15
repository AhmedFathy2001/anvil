import { NextResponse } from 'next/server';
import { buildSchedule } from '@/lib/pluginConfig';

// GET /api/plugin/schedule — unauthenticated list of active + upcoming events.
// Consumed by older plugin builds' "Upcoming" side-panel section. Newer builds read the
// same data merged into GET /api/plugin/config; this endpoint stays for backward compat.
// Read-only, cheap. See src/lib/pluginConfig.ts for the shared builder.
export async function GET() {
  return NextResponse.json(await buildSchedule());
}
