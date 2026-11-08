import { NextResponse } from 'next/server';

import { loadMoney } from '@/lib/money';
import { requireOwnerApi } from '@/lib/ownerAccess';

// Owner only (users.is_owner). Anyone else, including root, gets the same 404 as an unknown path.
export const dynamic = 'force-dynamic';

export async function GET() {
  const gate = await requireOwnerApi();
  if ('response' in gate) return gate.response;
  return NextResponse.json(await loadMoney(), { headers: { 'Cache-Control': 'no-store' } });
}
