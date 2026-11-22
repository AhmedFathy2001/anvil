import { NextResponse } from 'next/server';

import { verifyAdminOrModerator } from '@/lib/auth';
import { itemBossRates } from '@/lib/huntRates';

// GET /api/admin/weekly/hunt-rates?ids=12650,11832
//
// The hunt form's "1 in 5,000" beside a row's "Closest to it": for each item or pet, the kills one
// drop is expected to take at each hiscores boss that drops it, from the wiki drop dataset the repo
// ships (lib/huntRates). Here rather than in the page because the dataset is too big to ship.

const MAX_IDS = 100;

export async function GET(request: Request) {
  const user = await verifyAdminOrModerator();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const ids = (new URL(request.url).searchParams.get('ids') ?? '')
    .split(',')
    .map((s) => Number(s))
    .filter((n) => Number.isInteger(n) && n > 0)
    .slice(0, MAX_IDS);
  const rates: Record<number, Record<string, number>> = {};
  for (const id of new Set(ids)) rates[id] = itemBossRates(id);
  return NextResponse.json({ rates });
}
