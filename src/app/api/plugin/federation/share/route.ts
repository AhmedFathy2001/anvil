import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// POST /api/plugin/federation/share — RETIRED. Federation was removed; clans now live in one site,
// so an account is not "shared" across instances — membership is a row.
//
// A tombstone rather than a deletion because plugins are never force-updated. This returns the same
// 403 those builds already received when an admin had federation switched off, so an un-updated
// client shows its existing "federation is off" message rather than an unhandled 404.
export async function POST() {
  return NextResponse.json({ error: 'Federation is off on this site.' }, { status: 403 });
}
