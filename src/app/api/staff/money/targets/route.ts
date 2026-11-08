import { NextResponse } from 'next/server';

import { requireOwnerApi } from '@/lib/ownerAccess';
import { searchTargets } from '@/lib/ownerTrials';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const gate = await requireOwnerApi();
  if ('response' in gate) return gate.response;
  const u = new URL(request.url);
  const kind = u.searchParams.get('kind') === 'boost' ? 'boost' : 'supporter';
  const q = (u.searchParams.get('q') ?? '').trim();
  if (q.length < 2) return NextResponse.json({ options: [] });
  return NextResponse.json({ options: await searchTargets(kind, q) });
}
