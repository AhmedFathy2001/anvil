import { NextResponse } from 'next/server';

import { verifyAdminOrModerator } from '@/lib/auth';
import { refuseForCreatorSpace } from '@/lib/creatorGuard';
import { competitionForRequest } from '@/lib/eventScope';
import { addManualDrop, decideHuntDrop, endHuntNow, updateHuntSettings } from '@/lib/itemHuntDb';

// Staff actions on an item hunt (lib/itemHuntDb). One route, one `action`:
//   add       "Add a drop": credit a character by hand, with a screenshot and the kill count or XP.
//   confirm   a member's proof, a held plugin report, or a plugin drop the result rests on.
//   reject    take a drop out of the standings (or never let it in).
//   end       "End now and post results".
//   settings  "How it ends" and "Who confirms drops".
// Every one is written to the clan's audit log by the function it calls.

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : null);

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const notForCreators = await refuseForCreatorSpace();
  if (notForCreators) return notForCreators;
  const user = await verifyAdminOrModerator();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Whose hunt is this? Ids are global and this one came from the URL (lib/eventScope).
  const comp = await competitionForRequest(request, parseInt((await params).id, 10));
  if (!comp || comp.type !== 'hunt') return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const by = { userId: user.userId };

  if (body.action === 'add') {
    const result = await addManualDrop(
      comp,
      {
        participantId: num(body.participantId) ?? -1,
        itemId: num(body.itemId),
        itemName: typeof body.itemName === 'string' ? body.itemName : '',
        source: typeof body.source === 'string' && body.source.trim() ? body.source.trim() : null,
        quantity: num(body.quantity) ?? 1,
        occurredAt: typeof body.occurredAt === 'string' ? body.occurredAt : '',
        kc: num(body.kc),
        xp: num(body.xp),
        xpSkill: typeof body.xpSkill === 'string' ? body.xpSkill : null,
        screenshotUrl: typeof body.screenshotUrl === 'string' ? body.screenshotUrl : '',
        note: typeof body.note === 'string' ? body.note : null,
      },
      { ...by, staff: true },
    );
    return result.ok ? NextResponse.json(result) : NextResponse.json({ error: result.error }, { status: 400 });
  }

  if (body.action === 'confirm' || body.action === 'reject') {
    const result = await decideHuntDrop(comp, num(body.dropId) ?? -1, body.action, by);
    return result.ok ? NextResponse.json(result) : NextResponse.json({ error: result.error }, { status: 400 });
  }

  if (body.action === 'end') {
    const result = await endHuntNow(comp, by);
    return result.ok ? NextResponse.json(result) : NextResponse.json({ error: result.error }, { status: 400 });
  }

  if (body.action === 'settings') {
    const result = await updateHuntSettings(comp, body, by);
    return result.ok ? NextResponse.json(result) : NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
