import { NextResponse } from 'next/server';

import { GEAR_DATA } from '@/lib/dps/data';

// The gear calculator's datasets (items + monsters, ~600 KB before compression). Public, identical
// for every reader, and changed only by a deploy — so the browser and any proxy may keep it a day.
export async function GET() {
  return NextResponse.json(GEAR_DATA, {
    headers: { 'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800' },
  });
}
