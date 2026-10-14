import { NextResponse } from 'next/server';

import { verifyAdminOrModerator } from '@/lib/auth';
import { requireClan } from '@/lib/clanContext';
import { eventInClan } from '@/lib/eventScope';
import { sendFinalHour } from '@/lib/finalHour';

/**
 * Send the final-hour heads-up (lib/finalHour): the countdown post to every clan on the board, and a
 * ping of each team's role in its own channel. Host staff only — it reaches co-host servers too.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const id = Number((await params).eventId);
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!(await verifyAdminOrModerator())) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  const clan = await requireClan();
  const own = await eventInClan(clan.id, id);
  if (!own) return NextResponse.json({ error: 'Only the host can send this' }, { status: 404 });

  const result = await sendFinalHour(own.id);
  if ('error' in result) return NextResponse.json(result, { status: 409 });
  return NextResponse.json(result);
}
