import { NextResponse } from 'next/server';

import { analyticsOverview } from '@/lib/analyticsRead';
import { ownerOverview } from '@/lib/analyticsAttribution';
import { parseWindow } from '@/lib/analyticsFunnels';
import { requireOwnerApi } from '@/lib/ownerAccess';

export const dynamic = 'force-dynamic';

/** The analytics numbers as JSON. OWNER only — anyone else, staff included, gets the same 404. */
export async function GET(request: Request) {
  const gate = await requireOwnerApi();
  if ('response' in gate) return gate.response;
  const days = parseWindow(new URL(request.url).searchParams.get('days') ?? undefined);
  const [overview, owner] = await Promise.all([analyticsOverview(days), ownerOverview(days)]);
  return NextResponse.json({ overview, owner });
}
