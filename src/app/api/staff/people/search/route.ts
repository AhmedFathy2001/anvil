import { NextResponse } from 'next/server';

import { findPeople } from '@/lib/platformView';
import { requirePlatformApi } from '@/lib/platformAccess';

export const dynamic = 'force-dynamic';

/** Private identity lookup for the two sides of the staff merge tool. */
export async function GET(request: Request) {
  const gate = await requirePlatformApi('support');
  if ('response' in gate) return gate.response;

  const q = (new URL(request.url).searchParams.get('q') ?? '').trim();
  if (!q) return NextResponse.json({ results: [] });

  // A short name and a numeric person id are both legitimate here. This is staff-only and capped,
  // so unlike public search it does not turn into an identity-enumeration endpoint.
  const results = await findPeople(q, 12);
  return NextResponse.json({ results });
}
