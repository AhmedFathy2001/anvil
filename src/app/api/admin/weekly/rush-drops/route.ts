import { NextResponse } from 'next/server';

import { verifyAdminOrModerator } from '@/lib/auth';
import { rushDropList } from '@/lib/bossRush';
import { targetsFromInput } from '@/lib/bossRushRules';

// GET /api/admin/weekly/rush-drops?targets=Tormented%20Demon&targets=Vorkath
//
// The Boss Rush form's drop list: each target's notable drops, with a drop rate where the repo has
// one (lib/bossRush). Points are the host's to set; this only fills the list.

export async function GET(request: Request) {
  const user = await verifyAdminOrModerator();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const targets = targetsFromInput(new URL(request.url).searchParams.getAll('targets'));
  return NextResponse.json(await rushDropList(targets));
}
