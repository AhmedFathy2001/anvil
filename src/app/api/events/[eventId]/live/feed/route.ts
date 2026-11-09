import { NextResponse } from 'next/server';

import { liveFeed } from '@/lib/liveData';

import { liveScope } from '../scope';

// The Feed & chat page's Feed (app/events/[eventId]/live): the plugin panel's board Feed.
//
// GET ?f=all|tiles|drops|pets|achievements|deaths|milestones|team&n=<rows>&seat=<participant>
//     → the first n rows (a page at a time, capped), whether there are more, and their reactions.

export async function GET(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const url = new URL(request.url);
  const s = await liveScope((await params).eventId, url.searchParams.get('seat'));
  if (s instanceof NextResponse) return s;
  const state = await liveFeed(s.access, s.userId, url.searchParams.get('f'), url.searchParams.get('n'));
  return NextResponse.json(state, { headers: { 'Cache-Control': 'no-store' } });
}
