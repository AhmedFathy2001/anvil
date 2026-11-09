import { NextResponse } from 'next/server';

import { jsonWithEtag } from '@/lib/httpEtag';
import { livePulse } from '@/lib/liveData';

import { liveScope } from '../scope';

// "Anything new?" for the Feed & chat page: `{ c, f }`, the chat's and the Feed's fingerprints,
// 304 with no body when neither moved. The page asks every few seconds while it is in view and
// fetches only the half that changed (lib/liveData livePulse).

export async function GET(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const url = new URL(request.url);
  const s = await liveScope((await params).eventId, url.searchParams.get('seat'));
  if (s instanceof NextResponse) return s;
  return jsonWithEtag(request, await livePulse(s.access));
}
