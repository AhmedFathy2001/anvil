import { NextResponse } from 'next/server';
import { getActiveWeekly } from '@/lib/pluginConfig';

// GET — returns the currently active weekly competition (if any). Used by older plugin
// builds to decide whether to auto-enroll the signed-in player on login. Newer builds read
// the same data merged into GET /api/plugin/config; kept for backward compat. Read-only.
export async function GET() {
  return NextResponse.json(await getActiveWeekly());
}
