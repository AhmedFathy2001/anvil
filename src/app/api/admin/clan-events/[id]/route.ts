import { NextResponse } from 'next/server';

import { verifyAdminOrModerator } from '@/lib/auth';
import { requireClan } from '@/lib/clanContext';
import { cancelClanEvent, parseClanEventInput, updateClanEvent } from '@/lib/clanEvents';

// One clan event: edit it (the Discord announcement follows) or call it off.

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAdminOrModerator();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const clan = await requireClan();
  const id = Number((await params).id);
  const parsed = parseClanEventInput(await request.json().catch(() => ({})));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const row = Number.isInteger(id) ? await updateClanEvent(clan.id, id, parsed.input) : null;
  return row ? NextResponse.json({ id: row.id }) : NextResponse.json({ error: 'Not found' }, { status: 404 });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAdminOrModerator();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const clan = await requireClan();
  const id = Number((await params).id);
  const ok = Number.isInteger(id) && (await cancelClanEvent(clan.id, id));
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'Not found' }, { status: 404 });
}
