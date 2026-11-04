import { NextResponse } from 'next/server';

import { requireClan } from '@/lib/clanContext';
import { verifyAdmin } from '@/lib/auth';
import { isCreatorSpace } from '@/lib/creatorSpaces';
import { gateOptions } from '@/lib/entryGatesDb';

/**
 * Which "Who can join?" choices this creator space can offer right now (lib/entryGates) — for the
 * quick new-event screen, before there is an event to ask about. Twitch only when the server has it
 * configured; the Discord options only when the space's server is connected.
 */
export async function GET() {
  const clan = await requireClan();
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isCreatorSpace(clan)) return NextResponse.json({ error: 'Not a creator space' }, { status: 404 });
  return NextResponse.json(await gateOptions(clan.id));
}
