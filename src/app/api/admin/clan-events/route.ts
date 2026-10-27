import { NextResponse } from 'next/server';

import { verifyAdminOrModerator } from '@/lib/auth';
import { requireClan } from '@/lib/clanContext';
import { createClanEvent, listClanEvents, parseClanEventInput } from '@/lib/clanEvents';

// Clan events (lib/clanEvents): staff list and schedule them. Moderator-tier and up.

export async function GET() {
  const user = await verifyAdminOrModerator();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const clan = await requireClan();
  return NextResponse.json({ events: await listClanEvents(clan.id, { userId: user.userId }) });
}

export async function POST(request: Request) {
  const user = await verifyAdminOrModerator();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const clan = await requireClan();
  const parsed = parseClanEventInput(await request.json().catch(() => ({})));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const row = await createClanEvent(clan.id, parsed.input, user.userId);
  return NextResponse.json({ id: row.id }, { status: 201 });
}
