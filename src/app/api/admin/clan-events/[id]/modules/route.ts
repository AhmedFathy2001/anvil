import { NextResponse } from 'next/server';

import { verifyAdminOrModerator } from '@/lib/auth';
import { requireClan } from '@/lib/clanContext';
import { setClanEventModules } from '@/lib/clanEvents';

// A clan event's modules (lib/clanEventModules): sign-ups, fee, payouts, survey — each set up here.

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAdminOrModerator();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const clan = await requireClan();
  const id = Number((await params).id);
  const modules = Number.isInteger(id) ? await setClanEventModules(clan.id, id, await request.json().catch(() => ({}))) : null;
  return modules ? NextResponse.json({ modules }) : NextResponse.json({ error: 'Not found' }, { status: 404 });
}
