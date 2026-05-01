import { NextResponse } from 'next/server';

// Captain password login is retired — captains now claim their seat via Discord OAuth
// (see /api/captain/claim). This stub stays here so any bookmarked plugin/site flow
// gets a clear error pointing them at the new path instead of an obscure 404.
export async function POST() {
  return NextResponse.json(
    {
      error: 'Captain password login is no longer supported. Sign in with Discord and visit /captain to claim your team.',
    },
    { status: 410 },
  );
}
