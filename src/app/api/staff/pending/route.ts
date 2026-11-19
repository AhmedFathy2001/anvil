import { NextResponse } from 'next/server';

import { requirePlatformApi } from '@/lib/platformAccess';
import { staffBadges, staffPending } from '@/lib/staffPending';

export const dynamic = 'force-dynamic';

/**
 * The staff rail's badge counts, read live. The layout that draws the rail does not render again as
 * an operator moves between its pages, so the counts it was drawn with went stale until a full
 * reload; the rail asks here instead (AdminSidebar `badgeFeed`). Counts only, by link.
 */
export async function GET() {
  const gate = await requirePlatformApi('support');
  if ('response' in gate) return gate.response;
  return NextResponse.json(staffBadges(await staffPending(3_000)), { headers: { 'Cache-Control': 'no-store' } });
}
