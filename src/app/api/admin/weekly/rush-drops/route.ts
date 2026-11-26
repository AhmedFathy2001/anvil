import { NextResponse } from 'next/server';

import { verifyAdminOrModerator } from '@/lib/auth';
import { rushDropList } from '@/lib/bossRush';
import { BOSSES } from '@/lib/constants';
import { MAX_RUSH_BOSSES } from '@/lib/itemHunt';

// GET /api/admin/weekly/rush-drops?bosses=vorkath,zulrah
//
// The Boss Rush form's drop list: each picked boss's collection-log uniques, with a drop rate where
// the repo has one (lib/bossRush). Points are the host's to set; this only fills the list.

export async function GET(request: Request) {
  const user = await verifyAdminOrModerator();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const keys = [...new Set((new URL(request.url).searchParams.get('bosses') ?? '').split(',').map((k) => k.trim()))]
    .filter((k) => BOSSES.some((b) => b.key === k))
    .slice(0, MAX_RUSH_BOSSES);
  return NextResponse.json(rushDropList(keys));
}
